/**
 * Pure virtual-cursor math — the third member of the interaction "math" family
 * (dragMath.js for grabbing, pinchMath.js for camera hands, this one for the
 * on-canvas cursor that pictures them).
 *
 * A virtual cursor is a pointer DRAWN as an image instead of relying on the OS
 * cursor: the icon changes with what the pointer is doing, so a plain mouse
 * reads on screen (and in an exported video) like a hand reaching into the
 * sketch. Three states, matching the three artworks a sketch supplies:
 *
 *   "pointing"  — free pointer, over nothing grabbable
 *   "open"      — hovering a grabbable target, ready to close
 *   "grabbing"  — actually holding a target and moving it
 *
 * The state is derived from the SAME inputs the drag layer uses (its `drags`
 * map plus the frame's targets/radius), so the icon can never disagree with
 * what the sketch is really doing — hover uses `nearestTargetIndex`, exactly
 * like `stepDrag`'s own hover pass.
 *
 * Positions are EMA-smoothed for display only; the state is resolved from the
 * RAW pointer so a smoothed icon lagging behind never changes what is grabbed.
 * That smoothing is what lets a mouse stand in for a tracked hand: the same
 * lag the camera pinch tracker applies to jittery landmarks, applied to a
 * perfectly steady mouse, reads as a hand rather than a machine.
 *
 * Deliberately free of p5 / DOM imports so it stays cheap to unit-test; the
 * image loading and the actual drawing live in virtualCursor.js.
 */

import {
  nearestTargetIndex
} from "./dragMath.js";

export const CURSOR_POINTING = "pointing";
export const CURSOR_OPEN = "open";
export const CURSOR_GRABBING = "grabbing";

/**
 * Which of the three states a pointer is in this frame.
 *
 * @param {{ key: string, x: number, y: number, pressed: boolean }} pointer
 * @param {Map<string, number> | null} drags - The drag layer's live map
 *   (pointer key → target index). A pointer present here is holding something.
 * @param {Array<{x: number, y: number}>} targets - Pixel-space grab targets.
 * @param {number} radius - Pick-up radius (px), same value fed to the drag layer.
 * @returns {"pointing" | "open" | "grabbing"}
 */
export function resolveCursorState(
  pointer, drags, targets, radius
) {
  if ( drags?.has( pointer.key ) ) {
    return CURSOR_GRABBING;
  }

  const over = nearestTargetIndex(
    targets ?? [],
    pointer.x,
    pointer.y,
    radius
  ) !== -1;

  return over ? CURSOR_OPEN : CURSOR_POINTING;
}

/**
 * One frame of the virtual-cursor layer, over every pointer at once.
 *
 * Reads/writes only `state` (mutated in place — pointers that vanished are
 * pruned so their smoothing doesn't linger and snap a later pointer of the
 * same key) and returns what to draw.
 *
 * @param {{ positions: Map }} state - Per-pointer smoothed positions.
 * @param {Array<{ key, x, y, pressed, kind }>} pointers - Drag-layer pointers.
 * @param {object} [config]
 * @param {Map<string, number>} [config.drags] - Live drag map (see above).
 * @param {Array<{x, y}>} [config.targets] - Grab targets for the hover test.
 * @param {number} [config.radius=44] - Pick-up radius (px).
 * @param {number} [config.smoothing=0] - EMA lag on the drawn position
 *   (0 = none, 0.95 = max). Display only.
 * @returns {Array<{ key, kind, x, y, state }>} cursors to draw.
 */
export function stepCursors(
  state, pointers, {
    drags = null,
    targets = [],
    radius = 44,
    smoothing = 0
  } = {}
) {
  const present = new Set( pointers.map( ( pointer ) => pointer.key ) );

  for ( const key of [
    ...state.positions.keys()
  ] ) {
    if ( !present.has( key ) ) {
      state.positions.delete( key );
    }
  }

  const lag = Math.min(
    0.95,
    Math.max(
      0,
      smoothing
    )
  );

  return pointers.map( ( pointer ) => {
    let position = state.positions.get( pointer.key );

    if ( !position ) {
      position = {
        x: pointer.x,
        y: pointer.y
      };
      state.positions.set(
        pointer.key,
        position
      );
    }

    position.x += ( pointer.x - position.x ) * ( 1 - lag );
    position.y += ( pointer.y - position.y ) * ( 1 - lag );

    return {
      key: pointer.key,
      kind: pointer.kind,
      x: position.x,
      y: position.y,
      state: resolveCursorState(
        pointer,
        drags,
        targets,
        radius
      )
    };
  } );
}
