import type {
  SketchEngine
} from "@/engines/types";
import type {
  SketchOption
} from "@/types/sketch.types";
import type {
  RecorderHost
} from "./types";

export type SlidePlaylistEntry = {
  slideIndex: number;
  totalFrames: number;
};

export type CreateSlidePlaylistHostOptions = {
  engine: SketchEngine;
  options: SketchOption;
  slideIndices: number[];
  /** The one framerate the whole clip runs at. */
  frameRate: number;
  /**
   * Switch to a slide and wait until it is actually on screen. Supplied by the
   * runner because it also has to re-push the export override afterwards —
   * `window.setSlide()` re-derives the canvas size from the slide's own
   * settings and would otherwise undo it.
   */
  selectSlide: ( slideIndex: number ) => Promise<void>;
};

/**
 * A `RecorderHost` that presents several slides as one continuous frame range.
 *
 * This is what produces the combined `.mp4`: `AsyncLoopRecorder` and the
 * mediabunny encoder see a single stream and write a single file, with no
 * concatenation and no re-encode. There is no ffmpeg in the browser here, so
 * capturing straight into one encoder is not just the cheap route — it is the
 * only one.
 *
 * Two things it must get right, both invisible from the `RecorderHost`
 * contract:
 *
 * 1. **Frame indices are global to the recorder and local to the engine.** The
 *    deterministic clock renders frame `n` at `t = n / frameRate` and does not
 *    wrap during capture, so handing a global index to the second slide would
 *    draw it past the end of its own loop. `seekAndDraw` therefore resolves
 *    the global index to `(slide, localFrame)` and seeks the engine locally.
 * 2. **The capture surface must never change size mid-run.** The encoder
 *    snapshots its dimensions once, at `start()`. The runner guarantees this
 *    by forcing one resolution across every slide before the recorder is
 *    created; this host must not do anything that resizes.
 */
export function createSlidePlaylistHost( {
  engine,
  options,
  slideIndices,
  frameRate,
  selectSlide
}: CreateSlidePlaylistHostOptions ): RecorderHost {
  if ( slideIndices.length === 0 ) {
    throw new Error( "createSlidePlaylistHost: needs at least one slide." );
  }

  const entries: SlidePlaylistEntry[] = slideIndices.map( ( slideIndex ) => ( {
    slideIndex,
    totalFrames: Math.max(
      1,
      Math.round( engine.getTotalFrames(
        options,
        slideIndex
      ) )
    )
  } ) );

  const totalFrames = entries.reduce(
    (
      sum, entry
    ) => sum + entry.totalFrames,
    0
  );

  // The slide the engine is currently showing, as a playlist position. Starts
  // unset so the first seek always switches explicitly rather than assuming
  // the run began on slide 0.
  let currentPosition = -1;

  /** Map a global frame index onto its slide and that slide's local frame. */
  const locate = ( frame: number ): {
    position: number;
    localFrame: number;
  } => {
    const clamped = Math.min(
      Math.max(
        0,
        Math.round( frame )
      ),
      totalFrames - 1
    );
    let remaining = clamped;

    for ( let position = 0; position < entries.length; position++ ) {
      if ( remaining < entries[ position ].totalFrames ) {
        return {
          position,
          localFrame: remaining
        };
      }

      remaining -= entries[ position ].totalFrames;
    }

    const last = entries.length - 1;

    return {
      position: last,
      localFrame: entries[ last ].totalFrames - 1
    };
  };

  const goTo = async( position: number ): Promise<void> => {
    if ( position === currentPosition ) {
      return;
    }

    await selectSlide( entries[ position ].slideIndex );
    currentPosition = position;
  };

  return {
    getCaptureSource: () => engine.getCaptureSource(),
    getCanvas: () => engine.getCanvas(),
    seekAndDraw: async( frame: number ) => {
      const {
        position, localFrame
      } = locate( frame );

      await goTo( position );
      await engine.seekAndDraw( localFrame );
    },
    resetToStart: async() => {
      await goTo( 0 );
      await engine.resetToStart();
    },
    pause: () => engine.pause(),
    resume: () => engine.play(),
    beginDeterministicCapture: () => engine.beginDeterministicCapture(),
    endDeterministicCapture: () => engine.endDeterministicCapture(),
    totalFrames,
    frameRate
  };
}
