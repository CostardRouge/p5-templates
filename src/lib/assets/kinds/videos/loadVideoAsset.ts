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
  computeVideoPhase, defaultVideoParams, type VideoParams
} from "./types";

export type LoadVideoOptions = {
  /** Job id used to resolve S3-backed paths. */
  jobId?: string;
  /** When `false`, the `<video>` element stays visible (debugging). */
  hidden?: boolean;
};

/** Either a full asset instance, a bare path, or nothing (empty source). */
export type VideoSourceInput =
  | AssetInstance<VideoParams>
  | string
  | null
  | undefined;

/**
 * Runtime handle to a video asset bound to its time-stretch parameters.
 *
 * Sketches typically read `element` each frame as if it were a `p5.Image`
 * (`p.image(source.element, …)`). Whether the video is driven by wall-clock
 * (`play()` for live preview) or by the sketch's own progression
 * (`seekToProgression(p)` for deterministic capture) is up to the caller.
 *
 * The handle is resilient by design: it can be created with no path at all
 * (nothing selected yet) and given one later via `load()`. Until a video is
 * actually loaded, `hasVideo` is `false` and the seek/play methods are safe
 * no-ops, so a sketch never has to guard against a missing asset.
 */
export type VideoSource = {
  /** Underlying `<video>` element. Reusable as a p5 image source. */
  readonly element: HTMLVideoElement;
  /** Path currently loaded (empty string when none). */
  readonly path: string;
  /** Whether a real video is loaded and drawable. */
  readonly hasVideo: boolean;
  /** Current params snapshot. Cheap to read; updated via `updateParams`. */
  readonly params: VideoParams;
  /**
   * Resolves when the currently-loading video has enough metadata to seek.
   * Re-created on every `load()`, and already-resolved when no video is set.
   */
  readonly ready: Promise<void>;
  /** Video duration in seconds. `0` until loaded. */
  readonly duration: number;

  /**
   * (Re)load a video from an instance or bare path. Passing an empty/null
   * value clears the current video and leaves the handle in its empty
   * state. Safe to call any time, including after setup.
   */
  load( source: VideoSourceInput ): void;

  /**
   * Set `<video>.currentTime` so that the video shows the frame mapped
   * from sketch progression `p` ∈ [0, 1] through the params. Resolves once
   * the browser fires `seeked`. No-op when no video is loaded.
   *
   * Determinism note: standard `currentTime` seeks may snap to the nearest
   * keyframe. Using `requestVideoFrameCallback` (Chromium) is frame-accurate;
   * this implementation prefers it when available.
   */
  seekToProgression( p: number ): Promise<void>;

  /** Start wall-clock playback. Useful for preview. No-op when empty. */
  play(): Promise<void>;
  /** Pause wall-clock playback. */
  pause(): void;

  /** Swap params in-place (e.g. user changed a slider) without reloading. */
  updateParams( next: VideoParams ): void;

  /** Stop playback, detach the element from the DOM. */
  dispose(): void;
};

const NEAR_ZERO = 1e-4;

/** Normalize the various `load()` inputs into `{ path, params }`. */
function normalizeSource( source: VideoSourceInput ): {
  path: string;
  params: VideoParams;
} {
  if ( !source ) {
    return {
      path: "",
      params: {
        ...defaultVideoParams
      }
    };
  }

  if ( typeof source === "string" ) {
    return {
      path: source,
      params: {
        ...defaultVideoParams
      }
    };
  }

  return {
    path: source.path ?? "",
    params: source.params ?? {
      ...defaultVideoParams
    }
  };
}

/**
 * Create a `VideoSource`. The optional `source` may be an asset instance, a
 * bare path, or omitted entirely — in which case the handle starts empty and
 * a video can be supplied later via `load()`.
 */
export function loadVideoAsset(
  source?: VideoSourceInput,
  options: LoadVideoOptions = {}
): VideoSource {
  const element = document.createElement( "video" );

  element.muted = true;
  // WebKit checks the *attribute* (and `defaultMuted`) when deciding whether
  // a programmatic play() counts as muted autoplay — the property alone is
  // not enough on iOS.
  element.defaultMuted = true;
  element.setAttribute(
    "muted",
    ""
  );
  element.playsInline = true;
  element.setAttribute(
    "webkit-playsinline",
    ""
  );
  element.preload = "auto";
  element.crossOrigin = "anonymous";

  if ( options.hidden === false ) {
    element.style.display = "";
  } else {
    // Hide off-screen instead of `display: none`: WebKit stops decoding (and
    // never presents frames to canvas drawImage) for display:none videos.
    element.style.position = "fixed";
    element.style.left = "-99999px";
    element.style.top = "0";
    element.style.width = "2px";
    element.style.height = "2px";
    element.style.opacity = "0";
    element.style.pointerEvents = "none";
  }

  document.body.appendChild( element );

  let currentPath = "";
  let params: VideoParams = {
    ...defaultVideoParams
  };
  let ready: Promise<void> = Promise.resolve();
  let lastTarget = -1;
  let activeSeek: Promise<void> | null = null;

  function load( next: VideoSourceInput ): void {
    const normalized = normalizeSource( next );

    params = normalized.params;

    // Same path already loaded → nothing to do (params were refreshed above).
    if ( normalized.path === currentPath ) {
      return;
    }

    currentPath = normalized.path;
    activeSeek = null;
    lastTarget = -1;

    if ( !currentPath ) {
      element.pause();
      element.removeAttribute( "src" );
      element.load();
      element.removeAttribute( "data-video-asset" );
      ready = Promise.resolve();
      return;
    }

    element.setAttribute(
      "data-video-asset",
      currentPath
    );
    element.src = resolveAssetURL(
      currentPath,
      options.jobId
    );

    ready = new Promise<void>( (
      resolve, reject
    ) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject( new Error( `Failed to load video asset: ${ currentPath }` ) );
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

    // iOS ignores `preload="auto"` in several situations (Low Power Mode,
    // cellular); an explicit load() reliably kicks off the metadata fetch.
    element.load();

    // Surface load failures without leaving an unhandled rejection.
    ready.catch( ( error ) => {
      console.warn(
        "[loadVideoAsset]",
        error
      );
    } );

    const expectedPath = currentPath;

    ready.then( () => {
      if ( expectedPath === currentPath ) {
        primeDecode();
      }
    } ).catch( () => {} );
  }

  /**
   * WebKit won't decode frames for a video that has never played:
   * `drawImage(video)` silently paints nothing, and seeks alone don't start
   * the decoder. A muted inline play() — allowed without a user gesture —
   * followed by a pause on the first `timeupdate` (first decoded frame)
   * spins the decoder up so subsequent seeked frames reach the canvas.
   */
  function primeDecode(): void {
    const stop = () => {
      element.removeEventListener(
        "timeupdate",
        stop
      );
      element.pause();
    };

    element.addEventListener(
      "timeupdate",
      stop
    );

    element.play().catch( () => {
      element.removeEventListener(
        "timeupdate",
        stop
      );
    } );
  }

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
    if ( !currentPath ) {
      return;
    }

    // Capture the path at entry: `load()` may swap the underlying video
    // while we await `ready`, in which case the seek we were about to
    // issue no longer applies.
    const expectedPath = currentPath;

    await ready;

    if ( expectedPath !== currentPath ) {
      return;
    }

    const target = progressionToTime( p );

    if ( Math.abs( target - element.currentTime ) < NEAR_ZERO ) {
      return;
    }

    lastTarget = target;

    if ( activeSeek ) {
      // Coalesce: let the in-flight seek finish, then re-issue if the
      // target has moved on.
      await activeSeek;
      if ( Math.abs( lastTarget - element.currentTime ) < NEAR_ZERO ) {
        return;
      }
    }

    activeSeek = trackPendingMedia( new Promise<void>( ( resolve ) => {
      let pollId: ReturnType<typeof setInterval> | null = null;

      const settle = () => {
        element.removeEventListener(
          "seeked",
          settle
        );
        element.removeEventListener(
          "error",
          settle
        );
        if ( pollId !== null ) {
          clearInterval( pollId );
        }
        activeSeek = null;
        resolve();
      };

      element.addEventListener(
        "seeked",
        settle
      );
      element.addEventListener(
        "error",
        settle
      );

      // WebKit occasionally drops the `seeked` event for hidden videos /
      // sub-frame deltas, which would leave this promise (and every
      // coalesced caller) hanging forever. Poll `seeking` as a fallback:
      // while it's `true` the seek is genuinely in flight and waiting is
      // correct; once it's `false` the seek finished even if no event fired.
      pollId = setInterval(
        () => {
          if ( !element.seeking ) {
            settle();
          }
        },
        500
      );

      element.currentTime = lastTarget;
    } ) );

    await activeSeek;

    // `requestVideoFrameCallback` is frame-accurate; await one tick so the
    // pixels visible to p5 actually match the seeked time. WebKit only fires
    // it when a frame is *composited*, which never happens for off-screen
    // videos — race a short timeout so iOS doesn't hang here.
    if ( typeof ( element as any ).requestVideoFrameCallback === "function" ) {
      await trackPendingMedia( new Promise<void>( ( resolve ) => {
        const timeoutId = setTimeout(
          resolve,
          250
        );

        ( element as any ).requestVideoFrameCallback( () => {
          clearTimeout( timeoutId );
          resolve();
        } );
      } ) );
    }
  }

  // Initial load (no-op when source is empty).
  load( source );

  return {
    element,
    get path() {
      return currentPath;
    },
    get hasVideo() {
      return Boolean( currentPath );
    },
    get params() {
      return params;
    },
    get ready() {
      return ready;
    },
    get duration() {
      const d = element.duration;

      return Number.isFinite( d ) ? d : 0;
    },

    load,
    seekToProgression,

    async play() {
      if ( !currentPath ) {
        return;
      }
      await ready;
      await element.play().catch( () => {} );
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
