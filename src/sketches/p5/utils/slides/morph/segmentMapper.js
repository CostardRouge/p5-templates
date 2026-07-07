import easing from "../../easing.js";

function clamp01( value ) {
  if ( !Number.isFinite( value ) ) {
    return 0;
  }

  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Map the slide's loop progression (0..1) to a segment of the montage:
 * which source we morph FROM, which we morph TO, and the eased local factor.
 *
 * Auto-fit: the slide's whole duration is divided evenly between segments, so
 * N sources play in equal time slots. Within each slot, `holdRatio` is spent
 * static on the source before the eased morph to the next begins.
 *
 * Loop modes:
 *   - "cyclic":   N segments, last → first wraps (seamless loop).
 *   - "once":     N-1 segments, first → last, no wrap (holds the last source).
 *   - "pingpong": 2*(N-1) segments, 0→…→N-1→…→0.
 *
 * `progression` is wrapped into [0,1): playback already wraps, and recording's
 * monotonic clock (seconds/duration) is folded back so one recorded pass equals
 * one montage cycle.
 *
 * @returns {{ fromIndex: number, toIndex: number, localT: number }}
 */
export function mapProgressionToSegment(
  progression, n, transition = {}
) {
  const holdRatio = clamp01( transition.holdRatio ?? 0 );
  const loop = transition.loop ?? "cyclic";
  const easingKey = transition.easing ?? "linear";

  let p = Number.isFinite( progression ) ? progression : 0;

  p -= Math.floor( p );

  if ( p < 0 ) {
    p += 1;
  }

  let fromIndex;
  let toIndex;
  let segP;

  if ( loop === "once" ) {
    const segCount = Math.max(
      1,
      n - 1
    );
    const scaled = p * segCount;
    const seg = Math.min(
      Math.floor( scaled ),
      segCount - 1
    );

    fromIndex = seg;
    toIndex = Math.min(
      seg + 1,
      n - 1
    );
    segP = scaled - seg;
  } else if ( loop === "pingpong" ) {
    const half = Math.max(
      1,
      n - 1
    );
    const segCount = 2 * half;
    const scaled = p * segCount;
    const seg = Math.min(
      Math.floor( scaled ),
      segCount - 1
    );

    segP = scaled - seg;

    if ( seg < half ) {
      fromIndex = seg;
      toIndex = seg + 1;
    } else {
      const k = seg - half;

      fromIndex = n - 1 - k;
      toIndex = n - 2 - k;
    }
  } else {
    // cyclic
    const segCount = n;
    const scaled = p * segCount;
    const seg = Math.min(
      Math.floor( scaled ),
      segCount - 1
    );

    fromIndex = seg;
    toIndex = ( seg + 1 ) % n;
    segP = scaled - seg;
  }

  // Hold on the source, then morph across the remainder of the slot.
  let t;

  if ( segP <= holdRatio ) {
    t = 0;
  } else {
    const span = 1 - holdRatio;

    t = span > 0 ? ( segP - holdRatio ) / span : 1;
  }

  const easeFn = easing[ easingKey ] ?? easing.linear;

  return {
    fromIndex,
    toIndex,
    localT: easeFn( clamp01( t ) )
  };
}

export default mapProgressionToSegment;
