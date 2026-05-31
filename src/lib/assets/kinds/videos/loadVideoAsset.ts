import {
  resolveAssetURL
} from "../../resolveAssetURL";
import {
  trackPendingMedia
} from "../../pendingMedia";
import type {
  AssetInstance
} from "../../types";
import {
  computeVideoPhase, type VideoParams
} from "./types";

export type LoadVideoOptions = {
  /** Job id used to resolve S3-backed paths. */
  jobId?: string;
  /** Optional CSS for the hidden video element. Mostly useful for debugging. */
  hidden?: boolean;
};

/**
 * Runtime handle to a video asset bound to its time-stretch parameters.
 *
 * Sketches typically read `element` each frame as if it were a `p5.Image`
 * (`p.image(source.element, …)`). Whether the video is driven by wall-clock
 * (`play()` for live preview) or by the sketch's own progression
 * (`seekToProgression(p)` for deterministic capture) is up to the caller.
 */
export type VideoSource = {
  /** Underlying `<video>` element. Reusable as a p5 image source. */
  readonly element: HTMLVideoElement;
  /** Path stored in the asset instance (for debugging / logging). */
  readonly path: string;
  /** Current params snapshot. Cheap to read; updated via `updateParams`. */
  readonly params: VideoParams;
  /** Resolves when the video has loaded enough metadata to seek. */
  readonly ready: Promise<void>;
  /** Video duration in seconds. `0` until `ready` resolves. */
  readonly duration: number;

  /**
   * Set `<video>.currentTime` so that the video shows the frame mapped
   * from sketch progression `p` ∈ [0, 1] through the instance's params.
   * Resolves once the browser fires `seeked`.
   *
   * Determinism note: standard `currentTime` seeks may snap to the
   * nearest keyframe. Using `requestVideoFrameCallback` (Chromium) is
   * frame-accurate; this implementation prefers it when available.
   */
  seekToProgression( p: number ): Promise<void>;

  /** Start wall-clock playback. Useful for preview. */
  play(): Promise<void>;
  /** Pause wall-clock playback. */
  pause(): void;

  /** Swap params in-place (e.g. user changed a slider) without reloading. */
  updateParams( next: VideoParams ): void;

  /** Stop playback, detach handlers, revoke object URL if any. */
  dispose(): void;
};

const NEAR_ZERO = 1e-4;

/**
 * Create a `VideoSource` for the given asset instance. The returned
 * handle exposes the `<video>` element so it can be drawn into a p5
 * canvas (or any other engine) and the per-frame seek primitive that
 * applies the instance's time-stretch parameters.
 */
export function loadVideoAsset(
  instance: AssetInstance<VideoParams>,
  options: LoadVideoOptions = {}
): VideoSource {
  const url = resolveAssetURL(
    instance.path,
    options.jobId
  );

  const element = document.createElement( "video" );

  element.src = url;
  element.muted = true;
  element.playsInline = true;
  element.preload = "auto";
  element.crossOrigin = "anonymous";
  element.style.display = options.hidden === false ? "" : "none";
  element.setAttribute(
    "data-video-asset",
    instance.path
  );

  if ( !element.parentElement ) {
    document.body.appendChild( element );
  }

  let params = instance.params;
  let lastTarget = -1;
  let activeSeek: Promise<void> | null = null;

  const ready = new Promise<void>( (
    resolve, reject
  ) => {
    if ( element.readyState >= 1 ) {
      resolve();
      return;
    }

    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject( new Error( `Failed to load video asset: ${ instance.path }` ) );
    };
    const cleanup = () => {
      element.removeEventListener(
        "loadedmetadata",
        onLoaded
      );
      element.removeEventListener(
        "error",
        onError
      );
    };

    element.addEventListener(
      "loadedmetadata",
      onLoaded,
      {
        once: true
      }
    );
    element.addEventListener(
      "error",
      onError,
      {
        once: true
      }
    );
  } );

  function progressionToTime( p: number ): number {
    const duration = element.duration;

    if ( !Number.isFinite( duration ) || duration <= 0 ) {
      return 0;
    }

    const phase = computeVideoPhase(
      p,
      params
    );
    // Stay just inside the duration so the browser doesn't loop / clamp.
    return Math.min(
      duration - NEAR_ZERO,
      Math.max(
        0,
        phase * duration
      )
    );
  }

  async function seekToProgression( p: number ): Promise<void> {
    await ready;

    const target = progressionToTime( p );

    if ( Math.abs( target - element.currentTime ) < NEAR_ZERO ) {
      return;
    }

    lastTarget = target;

    if ( activeSeek ) {
      // Coalesce: let the in-flight seek finish first, then re-issue if
      // the target has moved.
      await activeSeek;
      if ( Math.abs( lastTarget - element.currentTime ) < NEAR_ZERO ) {
        return;
      }
    }

    activeSeek = trackPendingMedia( new Promise<void>( ( resolve ) => {
      const onSeeked = () => {
        element.removeEventListener(
          "seeked",
          onSeeked
        );
        activeSeek = null;
        resolve();
      };

      element.addEventListener(
        "seeked",
        onSeeked
      );
      element.currentTime = lastTarget;
    } ) );

    await activeSeek;

    // `requestVideoFrameCallback` is frame-accurate; await one tick so the
    // pixels visible to p5 actually match the seeked time.
    if ( typeof ( element as any ).requestVideoFrameCallback === "function" ) {
      await trackPendingMedia( new Promise<void>( ( resolve ) => {
        ( element as any ).requestVideoFrameCallback( () => resolve() );
      } ) );
    }
  }

  return {
    element,
    path: instance.path,
    get params() {
      return params;
    },
    ready,
    get duration() {
      const d = element.duration;

      return Number.isFinite( d ) ? d : 0;
    },

    seekToProgression,

    async play() {
      await ready;
      await element.play();
    },

    pause() {
      element.pause();
    },

    updateParams( next: VideoParams ) {
      params = next;
    },

    dispose() {
      element.pause();
      element.removeAttribute( "src" );
      element.load();
      element.parentElement?.removeChild( element );
    }
  };
}
