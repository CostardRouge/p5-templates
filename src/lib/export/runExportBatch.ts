import {
  createEngineHost,
  createRecorder,
  createSlidePlaylistHost,
  type RecorderProgress
} from "@/engines/recording";
import {
  captureFreshPngBlob
} from "@/lib/canvasSnapshot";
import {
  createZip, type ZipEntry
} from "@/utils/clientZip";
import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import {
  applyExportOverrides, type OverrideHandle
} from "./overrideScope";
import {
  phaseFraction, phasesFor, type ExportPhase
} from "./progress";
import nextFrame from "./nextFrame";
import {
  resolveFrameIndices
} from "./frameSampling";
import {
  nativeFramerateFor,
  resolveRunSize,
  resolveSlideIndices,
  variantFileName,
  type ExportSize,
  type ExportVariant
} from "./variants";

export type ExportItemStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export type ExportItemState = {
  variantId: string;
  status: ExportItemStatus;
  /** 0-100 across the whole variant, slides included. */
  percentage: number;
  /** Which phase the variant is in right now. */
  phase: ExportPhase;
  /**
   * How far into that phase, 0-1 — what the panel's phase meter fills.
   *
   * `null` means the phase reports nothing: the encoder hands back one
   * "encoding" event and then blocks inside `finalize()`, so there is no
   * number to show. The meter renders that segment as an indeterminate sweep
   * rather than inventing a percentage, which is exactly the case where the
   * old bar sat pinned at 100% and read as a hang.
   */
  phaseProgress: number | null;
  /**
   * Frames captured out of the slide's total, while a phase counts them.
   *
   * Two numbers, never a formatted string: the panel pads the count to the
   * total's width, and a pre-formatted `38% (172/450)` changing width on every
   * captured frame is what made the table re-measure its columns mid-run.
   */
  frame?: number;
  totalFrames?: number;
  /** 1-based, for multi-slide variants. */
  slide?: number;
  slideCount?: number;
  bytes?: number;
  error?: string;
};

export type ExportBatchProgress = ( items: ExportItemState[] ) => void;

/**
 * Hand a finished variant's files to the caller.
 *
 * This is the run's ONLY delivery channel. The runner used to download each
 * variant itself the moment it finished, which on a phone raced its own modal
 * save prompts and lost files — see `delivery.ts`. Capturing and delivering are
 * now separate jobs, and this is the seam: the caller decides whether these
 * files download straight away or wait for a deliberate save.
 *
 * Deliberately a second channel rather than a field on `ExportItemState`: that
 * type is the progress feed, copied for every listener on every frame, and is
 * no place for blobs. The caller owns what it keeps and when it releases it —
 * the runner itself retains nothing once this returns.
 *
 * `bundleFileName` is the name the set takes when it collapses into one `.zip`.
 * It is passed rather than derived because only the runner knows the size the
 * variant actually rendered at.
 */
export type ExportBatchArtifacts = (
  variantId: string,
  artifacts: ExportArtifact[],
  bundleFileName: string
) => void;

export type RunExportBatchArgs = {
  engine: SketchEngine;
  options: SketchOption;
  sketchName: string;
  activeSlideIndex: number | undefined;
  variants: ExportVariant[];
  onProgress?: ExportBatchProgress;
  onArtifacts?: ExportBatchArtifacts;
  signal?: AbortSignal;
  /** Switch slides. Injected so the runner stays testable without `window`. */
  selectSlide?: ( slideIndex: number ) => Promise<void>;
};

export type ExportArtifact = {
  fileName: string;
  blob: Blob;
};

function isAbort( error: unknown ): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function abortError(): DOMException {
  return new DOMException(
    "Export cancelled.",
    "AbortError"
  );
}

/** The default slide switcher: the runtime bridge the studio already uses. */
async function defaultSelectSlide( slideIndex: number ): Promise<void> {
  window.setSlide?.( slideIndex );

  // Give the engine a couple of frames to actually show the slide. p5 switches
  // synchronously; the GSAP runtime re-renders a React tree first, and reading
  // its mirror canvas in the same tick would rasterise the previous slide.
  await nextFrame();
  await nextFrame();
}

async function blobToBytes( blob: Blob ): Promise<Uint8Array> {
  return new Uint8Array( await blob.arrayBuffer() );
}

function canvasToPngBlob( canvas: HTMLCanvasElement ): Promise<Blob> {
  return new Promise( (
    resolve, reject
  ) => {
    canvas.toBlob(
      ( blob ) => {
        if ( !blob ) {
          reject( new Error( "Frame export: canvas.toBlob returned null." ) );

          return;
        }

        resolve( blob );
      },
      "image/png"
    );
  } );
}

/**
 * Record one continuous clip from a host, resolving with its blob.
 *
 * Wraps the recorder's event API in a promise and forwards frame progress, so
 * both the single-slide and the slide-playlist paths report the same way.
 */
function recordToBlob( args: {
  host: Parameters<typeof createRecorder>[ 0 ][ "host" ];
  variant: ExportVariant;
  audio: boolean;
  signal?: AbortSignal;
  onProgress: ( progress: RecorderProgress ) => void;
} ): Promise<Blob> {
  const {
    host, variant, audio, signal, onProgress
  } = args;

  return new Promise<Blob>( (
    resolve, reject
  ) => {
    let recorder: ReturnType<typeof createRecorder>;

    try {
      recorder = createRecorder( {
        host,
        format: variant.format,
        mode: "async-loop",
        audio
      } );
    } catch( error ) {
      reject( error );

      return;
    }

    const onAbort = () => {
      recorder.cancel();
    };

    signal?.addEventListener(
      "abort",
      onAbort,
      {
        once: true
      }
    );

    const settle = () => signal?.removeEventListener(
      "abort",
      onAbort
    );

    recorder.on(
      "progress",
      onProgress
    );
    recorder.on(
      "stop",
      ( result ) => {
        settle();
        resolve( result.blob );
      }
    );
    recorder.on(
      "error",
      ( error ) => {
        settle();
        reject( error );
      }
    );
    recorder.on(
      "cancel",
      () => {
        settle();
        reject( abortError() );
      }
    );

    recorder.start().catch( ( error ) => {
      settle();
      reject( error );
    } );
  } );
}

/**
 * A recorder event, as a phase the panel can draw.
 *
 * Only `capturing` carries a usable number. The recorder emits exactly one
 * `encoding` event and then blocks inside the encoder's `finalize()`, and one
 * `finalizing` event once that returns — so those two report `null` and the
 * meter sweeps instead of pretending to advance. What they replace is worse
 * than nothing: the bar used to be pinned at 100% for the whole encode, over a
 * label that never changed, which is indistinguishable from a hang.
 */
function recorderPhase( progress: RecorderProgress ): StageUpdate {
  if ( progress.stage === "capturing" ) {
    return {
      phase: "capturing",
      within: progress.totalFrames > 0
        ? progress.frame / progress.totalFrames
        : null,
      frame: progress.frame,
      totalFrames: progress.totalFrames
    };
  }

  return {
    phase: progress.stage === "encoding" ? "encoding" : "saving",
    within: null,
    frame: progress.totalFrames,
    totalFrames: progress.totalFrames
  };
}

/**
 * Run a list of export variants against the live sketch.
 *
 * Each variant pushes its own canvas size and framerate into the engine, is
 * captured, and is then rolled back — so a Reel next to a square post is two
 * genuine re-layouts of the sketch, not one capture rescaled twice.
 *
 * The whole run sits inside a single `try/finally`: whatever happens — a
 * failed variant, a cancel, an engine error — the sketch goes back to the size,
 * framerate, slide and playback state it was found in.
 */
export async function runExportBatch( {
  engine,
  options,
  sketchName,
  activeSlideIndex,
  variants,
  onProgress,
  onArtifacts,
  signal,
  selectSlide = defaultSelectSlide
}: RunExportBatchArgs ): Promise<ExportItemState[]> {
  const slideCount = Array.isArray( options.slides ) ? options.slides.length : 0;

  const items: ExportItemState[] = variants.map( ( variant ) => ( {
    variantId: variant.id,
    status: "queued",
    percentage: 0,
    phase: "preparing",
    phaseProgress: 0
  } ) );

  const emit = () => onProgress?.( items.map( ( item ) => ( {
    ...item
  } ) ) );

  emit();

  const startedSlideIndex = activeSlideIndex;

  try {
    for ( let index = 0; index < variants.length; index++ ) {
      const variant = variants[ index ];
      const item = items[ index ];

      if ( signal?.aborted ) {
        item.status = "cancelled";
        emit();
        throw abortError();
      }

      // Indeterminate from the first instant, not a dead 0%: `Preparing` polls
      // the engine for a settled resize and has no number of its own, and a run
      // that shows nothing at all until the first frame lands is the "no start
      // of progress" the studio reported outside dev.
      item.status = "running";
      item.phase = "preparing";
      item.phaseProgress = null;
      emit();

      const phases = phasesFor( variant.kind );
      const slideIndices = resolveSlideIndices(
        variant,
        slideCount,
        activeSlideIndex
      );
      const runSize: ExportSize = resolveRunSize(
        variant,
        options,
        slideIndices
      ) ?? {
        width: 1080,
        height: 1350
      };
      const nativeFramerate = nativeFramerateFor(
        options,
        slideIndices[ 0 ]
      );
      const framerate = Math.min(
        variant.framerate ?? nativeFramerate,
        nativeFramerate
      );

      item.slideCount = slideIndices.length;
      emit();

      // One override scope per variant. Both exits below restore it, so a
      // failed variant never leaks its canvas size into the next one.
      let scope: OverrideHandle | null = null;

      try {
        scope = await applyExportOverrides(
          engine,
          options,
          {
            size: runSize,
            framerate
          },
          signal
        );
        const artifacts = await runVariant( {
          engine,
          options,
          variant,
          sketchName,
          slideIndices,
          runSize,
          framerate,
          handle: scope,
          signal,
          selectSlide,
          report: ( update ) => {
            const span = update.slideTotal ?? 1;
            const position = update.slidePosition ?? 0;

            item.phase = update.phase;
            item.phaseProgress = update.within;
            item.frame = update.frame;
            item.totalFrames = update.totalFrames;
            item.slide = update.slidePosition === undefined
              ? undefined
              : position + 1;
            // Slides are folded in HERE rather than in each runner, so one
            // formula covers them all — and the combined-video path, which
            // spans every slide in a single recording, simply reports no
            // position and is not divided by a slide count it never had.
            item.percentage = ( (
              position + phaseFraction(
                phases,
                update.phase,
                update.within ?? 0
              )
            ) / span ) * 100;
            emit();
          }
        } );

        await scope.restore();
        scope = null;

        onArtifacts?.(
          variant.id,
          artifacts,
          variantFileName(
            variant,
            sketchName,
            runSize,
            {
              bundled: true
            }
          )
        );

        item.status = "done";
        item.percentage = 100;
        item.phase = phases[ phases.length - 1 ];
        item.phaseProgress = 1;
        item.bytes = artifacts.reduce(
          (
            sum, artifact
          ) => sum + artifact.blob.size,
          0
        );
        emit();
      } catch( error ) {
        await scope?.restore();

        if ( isAbort( error ) || signal?.aborted ) {
          item.status = "cancelled";
          emit();
          throw abortError();
        }

        // One variant failing is not the batch failing — a 4K mp4 the encoder
        // refuses should not cost the user the square post queued behind it.
        item.status = "failed";
        item.error = error instanceof Error ? error.message : String( error );
        emit();
      }
    }
  } finally {
    if ( startedSlideIndex !== undefined && slideCount > 0 ) {
      try {
        await selectSlide( startedSlideIndex );
      } catch {
        // Restoring the slide must never mask the run's own outcome.
      }
    }

    for ( const item of items ) {
      if ( item.status === "queued" || item.status === "running" ) {
        item.status = "cancelled";
      }
    }

    emit();
  }

  return items;
}

type RunVariantArgs = {
  engine: SketchEngine;
  options: SketchOption;
  variant: ExportVariant;
  sketchName: string;
  slideIndices: Array<number | undefined>;
  runSize: ExportSize;
  framerate: number;
  handle: OverrideHandle;
  signal?: AbortSignal;
  selectSlide: ( slideIndex: number ) => Promise<void>;
  report: ( update: StageUpdate ) => void;
};

/**
 * One progress tick from a variant runner, before slides are folded in.
 *
 * A runner says what it is doing and how far into it — never a percentage of
 * the whole variant, and never a formatted label. Both of those are the
 * caller's to derive: the fold over slides belongs in one place (`runExportBatch`
 * does it), and a label built here would be a string the panel could only print,
 * not lay out.
 */
type StageUpdate = {
  phase: ExportPhase;
  /** 0-1 inside `phase` for the slide in hand; `null` when it cannot be known. */
  within: number | null;
  /** 0-based position in `slideIndices`; omitted when the run is not per-slide. */
  slidePosition?: number;
  /** How many slides the fold divides by; omitted alongside `slidePosition`. */
  slideTotal?: number;
  frame?: number;
  totalFrames?: number;
};

/** Capture one variant, returning its artifacts without downloading them. */
async function runVariant( args: RunVariantArgs ): Promise<ExportArtifact[]> {
  const {
    variant
  } = args;

  if ( variant.kind === "image" ) {
    return runImageVariant( args );
  }

  if ( variant.kind === "frames" ) {
    return runFramesVariant( args );
  }

  if (
    variant.delivery === "combined" &&
      args.slideIndices.length > 1 &&
      args.slideIndices.every( ( index ) => index !== undefined )
  ) {
    return runCombinedVideoVariant( args );
  }

  return runVideoVariant( args );
}

/**
 * Move to a slide and put the variant's override back.
 *
 * `window.setSlide()` re-derives the canvas size and framerate from the
 * slide's own settings, so without the re-apply every slide boundary would
 * quietly undo the variant's resolution.
 */
async function gotoSlide(
  args: Pick<RunVariantArgs, "handle" | "selectSlide">,
  slideIndex: number
): Promise<void> {
  await args.selectSlide( slideIndex );
  await args.handle.reapply();
}

async function runImageVariant( args: RunVariantArgs ): Promise<ExportArtifact[]> {
  const {
    engine, variant, sketchName, slideIndices, runSize, report
  } = args;
  const artifacts: ExportArtifact[] = [];

  for ( let position = 0; position < slideIndices.length; position++ ) {
    if ( args.signal?.aborted ) {
      throw abortError();
    }

    const slideIndex = slideIndices[ position ];

    if ( slideIndex !== undefined ) {
      await gotoSlide(
        args,
        slideIndex
      );
    }

    report( {
      phase: "capturing",
      within: null,
      slidePosition: position,
      slideTotal: slideIndices.length
    } );

    const blob = await captureFreshPngBlob( engine );

    if ( !blob ) {
      throw new Error( "Could not read a frame from the sketch." );
    }

    report( {
      phase: "saving",
      within: null,
      slidePosition: position,
      slideTotal: slideIndices.length
    } );

    artifacts.push( {
      fileName: variantFileName(
        variant,
        sketchName,
        runSize,
        {
          slideIndex: slideIndices.length > 1 ? slideIndex : undefined
        }
      ),
      blob
    } );
  }

  return artifacts;
}

async function runFramesVariant( args: RunVariantArgs ): Promise<ExportArtifact[]> {
  const {
    engine, options, variant, sketchName, slideIndices, runSize, report
  } = args;
  const artifacts: ExportArtifact[] = [];

  for ( let position = 0; position < slideIndices.length; position++ ) {
    const slideIndex = slideIndices[ position ];

    if ( slideIndex !== undefined ) {
      await gotoSlide(
        args,
        slideIndex
      );
    }

    const host = createEngineHost(
      engine,
      options,
      slideIndex
    );
    const totalFrames = Math.round( host.totalFrames );

    if ( !Number.isFinite( totalFrames ) || totalFrames <= 0 ) {
      throw new Error( "This sketch has no frames to export." );
    }

    const indices = resolveFrameIndices(
      variant.frameCount,
      totalFrames
    );
    const source = host.getCaptureSource();

    host.pause();
    host.beginDeterministicCapture();

    try {
      await host.resetToStart();

      const scratch = document.createElement( "canvas" );

      scratch.width = runSize.width;
      scratch.height = runSize.height;

      const context = scratch.getContext( "2d" );

      if ( !context ) {
        throw new Error( "Could not acquire a 2D context for frame export." );
      }

      const padWidth = Math.max(
        2,
        String( indices.length ).length
      );
      const entries: ZipEntry[] = [];

      for ( let frame = 0; frame < indices.length; frame++ ) {
        if ( args.signal?.aborted ) {
          throw abortError();
        }

        await host.seekAndDraw( indices[ frame ] );

        const image = await source.readFrame();

        context.clearRect(
          0,
          0,
          runSize.width,
          runSize.height
        );
        context.drawImage(
          image,
          0,
          0,
          runSize.width,
          runSize.height
        );

        entries.push( {
          name: `frame-${ String( frame + 1 ).padStart(
            padWidth,
            "0"
          ) }.png`,
          data: await blobToBytes( await canvasToPngBlob( scratch ) )
        } );

        report( {
          phase: "capturing",
          within: ( frame + 1 ) / indices.length,
          slidePosition: position,
          slideTotal: slideIndices.length,
          frame: frame + 1,
          totalFrames: indices.length
        } );
      }

      report( {
        phase: "saving",
        within: null,
        slidePosition: position,
        slideTotal: slideIndices.length,
        frame: indices.length,
        totalFrames: indices.length
      } );

      artifacts.push( {
        fileName: variantFileName(
          variant,
          sketchName,
          runSize,
          {
            slideIndex: slideIndices.length > 1 ? slideIndex : undefined
          }
        ),
        blob: createZip( entries )
      } );
    } finally {
      host.endDeterministicCapture();
    }
  }

  return artifacts;
}

async function runVideoVariant( args: RunVariantArgs ): Promise<ExportArtifact[]> {
  const {
    engine, options, variant, sketchName, slideIndices, runSize, framerate, report
  } = args;
  const artifacts: ExportArtifact[] = [];

  for ( let position = 0; position < slideIndices.length; position++ ) {
    if ( args.signal?.aborted ) {
      throw abortError();
    }

    const slideIndex = slideIndices[ position ];

    if ( slideIndex !== undefined ) {
      await gotoSlide(
        args,
        slideIndex
      );
    }

    const host = createEngineHost(
      engine,
      options,
      slideIndex
    );

    const blob = await recordToBlob( {
      host: {
        ...host,
        frameRate: framerate
      },
      variant,
      audio: true,
      signal: args.signal,
      onProgress: ( progress ) => report( {
        ...recorderPhase( progress ),
        slidePosition: position,
        slideTotal: slideIndices.length
      } )
    } );

    artifacts.push( {
      fileName: variantFileName(
        variant,
        sketchName,
        runSize,
        {
          slideIndex: slideIndices.length > 1 ? slideIndex : undefined
        }
      ),
      blob
    } );
  }

  return artifacts;
}

/**
 * Every selected slide captured into ONE encoder, producing a single
 * continuous file.
 *
 * Audio is deliberately off: the audio engine timestamps events against the
 * deterministic clock, which restarts on each slide, so one offline render
 * would pile every slide's sound onto the first slide's span.
 */
async function runCombinedVideoVariant( args: RunVariantArgs ): Promise<ExportArtifact[]> {
  const {
    engine, options, variant, sketchName, slideIndices, runSize, framerate, report
  } = args;

  const host = createSlidePlaylistHost( {
    engine,
    options,
    slideIndices: slideIndices as number[],
    frameRate: framerate,
    selectSlide: async( slideIndex: number ) => {
      await gotoSlide(
        args,
        slideIndex
      );
    }
  } );

  const blob = await recordToBlob( {
    host,
    variant,
    audio: false,
    signal: args.signal,
    // No slide position: every slide feeds one encoder here, so this IS the
    // whole variant. Folding it over a slide count would cap it at 1/N.
    onProgress: ( progress ) => report( recorderPhase( progress ) )
  } );

  report( {
    phase: "saving",
    within: 1
  } );

  return [
    {
      fileName: variantFileName(
        variant,
        sketchName,
        runSize
      ),
      blob
    }
  ];
}
