/**
 * Pure thumb+index pinch math — the camera-hand counterpart of dragMath.js.
 *
 * Turns "hand-shaped" point groups into drag-layer pointers: the thumb/index
 * midpoint is the pointer position (EMA-smoothed per hand — camera landmarks
 * are jittery), and "pressed" is a hysteresis latch on the tip gap (released
 * only at `releaseRatio ×` the grab distance) so a borderline pinch doesn't
 * flicker. First written inside splines-v2-draggable; factored here so any
 * sketch can pinch-grab with EVERY tracked hand at once.
 *
 * A group only needs `{ id, points }` where the trailing five points are the
 * fingertips in MediaPipe order (thumb, index, middle, ring, pinky) — exactly
 * what the interaction module's "hands" source produces, with or without the
 * optional leading palm point. Nothing here touches the camera, so scripted
 * "virtual hands" (pre-recorded pinch/move clips replayed as hand-shaped
 * groups) drive pinches exactly like live ones.
 *
 * Deliberately free of p5 / DOM imports so it stays cheap to unit-test; the
 * stateful wiring + on-canvas feedback live in handPinch.js.
 */

/**
 * Thumb and index tips of a hand-shaped point list, or null when the list is
 * too short to be a hand. The fingertips are the TRAILING five entries, so the
 * convention works with or without the optional leading palm point.
 *
 * @param {Array<{x: number, y: number}>} points
 * @returns {{ thumb: {x, y}, index: {x, y} } | null}
 */
export function fingertipsOf( points ) {
  if ( !points || points.length < 5 ) {
    return null;
  }

  return {
    thumb: points[ points.length - 5 ],
    index: points[ points.length - 4 ]
  };
}

/**
 * One step of the pinch state machine, for every hand at once.
 *
 * Reads/writes only the maps in `state` (mutated in place — hands that left
 * the frame are pruned so their smoothing / latch don't linger) and returns
 * the drag-layer pointers for this frame.
 *
 * @param {{ hands: Map, smooth: Map, latch: Map }} state - Per-hand state,
 *   keyed by the stable group id. `hands` is refreshed with drawable feedback:
 *   id → { thumb, index, mid, pinching }.
 * @param {Array<{ id: string, points: Array<{x, y}> }>} groups - Hand-shaped
 *   groups (live camera hands and/or virtual ones).
 * @param {object} [config]
 * @param {number} [config.pinch=70] - Tip gap (px) below which the pinch
 *   engages.
 * @param {number} [config.smoothing=0.4] - EMA lag on the midpoint (0 = none,
 *   0.95 = max). Only the pointer position is smoothed; the latch reads the
 *   raw gap.
 * @param {number} [config.releaseRatio=1.6] - An engaged pinch only releases
 *   beyond `pinch × releaseRatio` (hysteresis).
 * @returns {Array<{ key: string, x: number, y: number, pressed: boolean,
 *   kind: "camera" }>} pointers for draggable.update's `extraPointers`.
 */
export function stepPinch(
  state, groups, {
    pinch = 70,
    smoothing = 0.4,
    releaseRatio = 1.6
  } = {}
) {
  const present = new Set( groups.map( ( group ) => group.id ) );

  for ( const id of [
    ...state.hands.keys()
  ] ) {
    if ( !present.has( id ) ) {
      state.hands.delete( id );
      state.smooth.delete( id );
      state.latch.delete( id );
    }
  }

  const lag = Math.min(
    0.95,
    Math.max(
      0,
      smoothing
    )
  );
  const pointers = [];

  groups.forEach( ( group ) => {
    const tips = fingertipsOf( group.points );

    if ( !tips ) {
      return;
    }

    const {
      thumb,
      index
    } = tips;
    const rawMidX = ( thumb.x + index.x ) / 2;
    const rawMidY = ( thumb.y + index.y ) / 2;

    let smooth = state.smooth.get( group.id );

    if ( !smooth ) {
      smooth = {
        x: rawMidX,
        y: rawMidY
      };
      state.smooth.set(
        group.id,
        smooth
      );
    }

    smooth.x += ( rawMidX - smooth.x ) * ( 1 - lag );
    smooth.y += ( rawMidY - smooth.y ) * ( 1 - lag );

    const gap = Math.hypot(
      thumb.x - index.x,
      thumb.y - index.y
    );
    const pinching = state.latch.get( group.id )
      ? gap < pinch * releaseRatio
      : gap < pinch;

    state.latch.set(
      group.id,
      pinching
    );
    state.hands.set(
      group.id,
      {
        thumb,
        index,
        mid: {
          x: smooth.x,
          y: smooth.y
        },
        pinching
      }
    );

    pointers.push( {
      key: `cam-${ group.id }`,
      x: smooth.x,
      y: smooth.y,
      pressed: pinching,
      kind: "camera"
    } );
  } );

  return pointers;
}
