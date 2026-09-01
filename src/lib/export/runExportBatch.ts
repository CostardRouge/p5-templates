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
  triggerDownload
} from "./download";
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
  /** What the variant is doing right now, e.g. "Encoding…". */
  stage: string;
  /** 1-based, for multi-slide variants. */
  slide?: number;
  slideCount?: number;
  bytes?: number;
  error?: string;
};

export type ExportBatchProgress = ( items: ExportItemState[] ) => void;

/**
 * Hand a finished variant's files to the caller, so they can be previewed.
 *
 * Deliberately a second channel rather than a field on `ExportItemState`: that
 * type is the progress feed, copied for every listener on every frame, and is
 * no place for blobs. The caller owns what it keeps and when it releases it —
 * the runner itself retains nothing once this returns.
 */
export type ExportBatchArtifacts = (
  variantId: string, artifacts: ExportArtifact[]
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
    stage: "Queued"
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

      item.status = "running";
      item.stage = "Preparing…";
      emit();

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
          onStage: (
            stage, percentage, slide
          ) => {
            item.stage = stage;
            item.percentage = percentage;
            item.slide = slide;
            emit();
          }
        } );

        await scope.restore();
        scope = null;

        deliver(
          variant,
          artifacts,
          sketchName,
          runSize
        );

        // After delivering, so a preview can never delay the download the
        // user is already waiting on.
        onArtifacts?.(
          variant.id,
          artifacts
        );

        item.status = "done";
        item.percentage = 100;
        item.stage = "Done";
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
          item.stage = "Cancelled";
          emit();
          throw abortError();
        }

        // One variant failing is not the batch failing — a 4K mp4 the encoder
        // refuses should not cost the user the square post queued behind it.
        item.status = "failed";
        item.stage = "Failed";
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
        item.stage = "Cancelled";
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
  onStage: (
    stage: string, percentage: number, slide?: number
  ) => void;
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
    engine, variant, sketchName, slideIndices, runSize, onStage
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

    onStage(
      "Capturing…",
      ( position / slideIndices.length ) * 100,
      position + 1
    );

    const blob = await captureFreshPngBlob( engine );

    if ( !blob ) {
      throw new Error( "Could not read a frame from the sketch." );
    }

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
    engine, options, variant, sketchName, slideIndices, runSize, onStage
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

        onStage(
          `${ ( ( ( frame + 1 ) / indices.length ) * 100 ).toFixed( 0 ) }% (${ frame + 1 }/${ indices.length })`,
          ( ( position + ( frame + 1 ) / indices.length ) / slideIndices.length ) * 100,
          position + 1
        );
      }

      onStage(
        "Zipping…",
        100,
        position + 1
      );

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
    engine, options, variant, sketchName, slideIndices, runSize, framerate, onStage
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
      onProgress: ( progress ) => {
        const within = progress.stage === "capturing"
          ? progress.percentage
          : 100;

        onStage(
          progress.stage === "capturing"
            ? `${ progress.percentage.toFixed( 0 ) }% (${ progress.frame }/${ progress.totalFrames })`
            : progress.stage === "encoding" ? "Encoding…" : "Finalising…",
          ( ( position + within / 100 ) / slideIndices.length ) * 100,
          position + 1
        );
      }
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
    engine, options, variant, sketchName, slideIndices, runSize, framerate, onStage
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
    onProgress: ( progress ) => {
      onStage(
        progress.stage === "capturing"
          ? `${ progress.percentage.toFixed( 0 ) }% (${ progress.frame }/${ progress.totalFrames })`
          : progress.stage === "encoding" ? "Encoding…" : "Finalising…",
        progress.stage === "capturing" ? progress.percentage : 100
      );
    }
  } );

  onStage(
    "Done",
    100
  );

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

/**
 * Hand a variant's artifacts to the browser.
 *
 * One artifact downloads as itself; several are bundled into a single zip —
 * browsers throttle (and prompt on) a burst of programmatic downloads, so a
 * seven-slide variant firing seven `<a download>` clicks is not an option.
 */
function deliver(
  variant: ExportVariant,
  artifacts: ExportArtifact[],
  sketchName: string,
  runSize: ExportSize
): void {
  if ( artifacts.length === 0 ) {
    return;
  }

  if ( artifacts.length === 1 ) {
    triggerDownload(
      artifacts[ 0 ].blob,
      artifacts[ 0 ].fileName
    );

    return;
  }

  void Promise.all( artifacts.map( async( artifact ) => ( {
    name: artifact.fileName,
    data: await blobToBytes( artifact.blob )
  } ) ) ).then( ( entries ) => {
    triggerDownload(
      createZip( entries ),
      variantFileName(
        variant,
        sketchName,
        runSize,
        {
          bundled: true
        }
      )
    );
  } );
}
