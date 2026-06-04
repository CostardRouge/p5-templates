export type VideoLoopMode = "loop" | "clamp" | "ping-pong";

/**
 * How the video's native aspect ratio is reconciled with its draw box:
 *
 *  - `stretch`  — fill the box exactly, distorting if ratios differ.
 *  - `contain`  — scale to fit *inside* the box, preserving ratio (letterbox).
 *  - `cover`    — scale to *cover* the box, preserving ratio (may overflow).
 */
export type VideoFit = "stretch" | "contain" | "cover";

/**
 * Per-instance parameters for a video asset.
 *
 * Time-stretch — combined as `phase(p) = applyLoopMode(p * repeat * speed +
 * offset)`, where `p` is the sketch progression in [0, 1] and
 * `videoTime = phase * videoDuration`.
 *
 * Layout — `scale`, `posX`/`posY` and `fit` describe where and how big the
 * frame is drawn within whatever box the sketch hands it, via
 * {@link computeVideoLayout}.
 */
export type VideoParams = {
  /** Number of times the video plays across the sketch duration. */
  repeat: number;
  /** Playback speed relative to "fit exactly once over the sketch". */
  speed: number;
  /** Phase offset, in [0, 1] of the looped video timeline. */
  offset: number;
  /** Behaviour when phase exits [0, 1]: wrap, clamp, or triangle-wave. */
  loopMode: VideoLoopMode;
  /** Size relative to the draw box. 1 = fill the box, 0.5 = half, 2 = double. */
  scale: number;
  /** Horizontal offset as a fraction of the box width, in [-1, 1]. */
  posX: number;
  /** Vertical offset as a fraction of the box height, in [-1, 1]. */
  posY: number;
  /** How the video's native aspect ratio is reconciled with the box. */
  fit: VideoFit;
};

export const defaultVideoParams: VideoParams = {
  repeat: 1,
  speed: 1,
  offset: 0,
  loopMode: "loop",
  scale: 1,
  posX: 0,
  posY: 0,
  fit: "stretch"
};

/**
 * Map the sketch progression `p` ∈ [0, 1] to a phase in [0, 1] of the
 * video timeline, applying repeat, speed, offset, and the loop mode.
 * Returned phase is then multiplied by `videoDuration` to get a
 * `currentTime` value.
 */
export function computeVideoPhase(
  p: number, params: VideoParams
): number {
  const raw = p * params.repeat * params.speed + params.offset;

  switch ( params.loopMode ) {
    case "clamp":
      return Math.min(
        1,
        Math.max(
          0,
          raw
        )
      );
    case "ping-pong": {
      const mod = ( ( raw % 2 ) + 2 ) % 2;

      return mod <= 1 ? mod : 2 - mod;
    }
    case "loop":
    default: {
      const mod = raw % 1;

      return mod < 0 ? mod + 1 : mod;
    }
  }
}

/** An axis-aligned rectangle in sketch pixels. */
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Resolve where a video frame should be drawn given the sketch's available
 * `box` (e.g. a grid cell or the whole canvas), the video's `natural` pixel
 * size, and the instance's `scale` / `posX` / `posY` / `fit` params.
 *
 * The frame is first sized to the box according to `fit` (honoring the native
 * aspect ratio for `contain` / `cover`), then multiplied by `scale`, centered
 * in the box, and finally nudged by the relative position offset. `scale > 1`
 * and `cover` may extend past the box on purpose — the caller decides whether
 * to clip.
 */
export function computeVideoLayout(
  params: Partial<VideoParams> | undefined,
  box: Rect,
  natural: { width: number;
    height: number }
): Rect {
  const {
    scale: rawScale, posX, posY, fit
  } = {
    ...defaultVideoParams,
    ...( params ?? {} )
  };
  const scale = rawScale > 0 ? rawScale : 1;

  // Base size before scaling: fill the box, optionally preserving the ratio.
  let baseWidth = box.width;
  let baseHeight = box.height;

  const hasNatural = natural.width > 0 && natural.height > 0;

  if ( hasNatural && fit !== "stretch" ) {
    const boxRatio = box.width / box.height;
    const videoRatio = natural.width / natural.height;
    // `contain` matches the more constraining axis (fit inside); `cover`
    // matches the less constraining one (fill, possibly overflowing).
    const fitWidth =
      fit === "cover" ? videoRatio < boxRatio : videoRatio > boxRatio;

    if ( fitWidth ) {
      baseWidth = box.width;
      baseHeight = box.width / videoRatio;
    } else {
      baseHeight = box.height;
      baseWidth = box.height * videoRatio;
    }
  }

  const width = baseWidth * scale;
  const height = baseHeight * scale;

  return {
    width,
    height,
    // Centered in the box, then offset by a fraction of the box size.
    x: box.x + ( box.width - width ) / 2 + posX * box.width,
    y: box.y + ( box.height - height ) / 2 + posY * box.height
  };
}
