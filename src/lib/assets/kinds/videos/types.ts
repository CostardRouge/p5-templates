export type VideoLoopMode = "loop" | "clamp" | "ping-pong";

/**
 * Per-instance time-stretch parameters for a video asset. Combined as
 * `phase(p) = applyLoopMode(p * repeat * speed + offset)`, where `p` is the
 * sketch progression in [0, 1] and `videoTime = phase * videoDuration`.
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
};

export const defaultVideoParams: VideoParams = {
  repeat: 1,
  speed: 1,
  offset: 0,
  loopMode: "loop"
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
