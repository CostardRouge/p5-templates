/**
 * Pure drag math — the grab → move → release state machine shared by every
 * on-canvas draggable layer (splines-v2-draggable's control points, the
 * template content items in slides/contentDrag.js, …).
 *
 * Deliberately free of any p5 / DOM / runtime imports so it stays cheap to
 * unit-test. The stateful wiring (pointer collection, canvas affordance,
 * engine events) lives in `draggable.js`; everything here is a deterministic
 * function of its inputs.
 */

/**
 * Nearest target within `radius` of (x, y), skipping indices in `taken` so two
 * pointers can't fight over the same target. Returns -1 when nothing is close.
 *
 * @param {Array<{x: number, y: number}>} targets
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {Set<number>} [taken]
 */
export function nearestTargetIndex(
  targets, x, y, radius, taken = null
) {
  let best = -1;
  let bestDistance = radius * radius;

  for ( let i = 0; i < targets.length; i++ ) {
    if ( taken?.has( i ) ) {
      continue;
    }

    const dx = targets[ i ].x - x;
    const dy = targets[ i ].y - y;
    const distance = dx * dx + dy * dy;

    if ( distance < bestDistance ) {
      bestDistance = distance;
      best = i;
    }
  }

  return best;
}

/**
 * One step of the drag state machine. Pointers are source-agnostic — mouse,
 * finger, camera pinch all feed the same path as one { key, x, y, pressed,
 * kind } record. Every pointer is independent and keyed by a stable id, so
 * several can drag at once (one target per pointer, no two pointers on the
 * same target).
 *
 * Reads/writes only `drags` (mutated in place) and reports what happened.
 *
 * @typedef {{ key: string, x: number, y: number, pressed: boolean, kind: string }} DragPointer
 *
 * @param {Map<string, number>} drags - Active drags, pointer key → target index.
 * @param {Array<DragPointer>} pointers
 * @param {Array<{x: number, y: number}>} targets - Pixel-space targets.
 * @param {number} radius - Pick-up radius (px).
 * @param {(index: number, pointer: DragPointer) => void} onMove - Called for every
 *   grabbed target that should follow its pointer this step. May mutate
 *   `targets[index]` so later pointers in the same step see the new position.
 * @returns {{ hovers: Set<number>, grabbed: Set<number>, released: boolean }}
 */
export function stepDrag(
  drags, pointers, targets, radius, onMove
) {
  const activeKeys = new Set( pointers.map( ( pointer ) => pointer.key ) );
  let released = false;

  // Release any drag whose pointer vanished (finger lifted, hand left the
  // frame) or whose target index no longer exists (item removed mid-drag).
  for ( const key of [
    ...drags.keys()
  ] ) {
    if ( !activeKeys.has( key ) || drags.get( key ) >= targets.length ) {
      drags.delete( key );
      released = true;
    }
  }

  // Indices currently held, so no two pointers fight over the same target.
  const grabbed = new Set( drags.values() );
  const hovers = new Set();

  pointers.forEach( ( pointer ) => {
    if ( drags.has( pointer.key ) ) {
      const index = drags.get( pointer.key );

      if ( pointer.pressed ) {
        onMove(
          index,
          pointer
        );
      } else {
        drags.delete( pointer.key );
        grabbed.delete( index );
        released = true;
      }

      return;
    }

    if ( pointer.pressed ) {
      const index = nearestTargetIndex(
        targets,
        pointer.x,
        pointer.y,
        radius,
        grabbed
      );

      if ( index !== -1 ) {
        drags.set(
          pointer.key,
          index
        );
        grabbed.add( index );
        onMove(
          index,
          pointer
        );
      }

      return;
    }

    // Aiming (not pressed): highlight the target the mouse / open hand is
    // over. Touch can't hover — a finger is always a press.
    if ( pointer.kind !== "touch" ) {
      const index = nearestTargetIndex(
        targets,
        pointer.x,
        pointer.y,
        radius
      );

      if ( index !== -1 ) {
        hovers.add( index );
      }
    }
  } );

  return {
    hovers,
    grabbed,
    released
  };
}

/**
 * Diff two snapshots of a `drags` map into the grab / let-go transitions
 * between them — what a caller needs to react to the EDGES of a drag (click
 * feedback, haptics, undo checkpoints) rather than to its steady state.
 *
 * A pointer that swaps handles between the two snapshots counts as both an up
 * (on the handle it left) and a down (on the one it took) — the same two
 * button events a hand would make.
 *
 * @param {Map<string, number>} previous - Pointer key → target index, before.
 * @param {Map<string, number>} current - The same map, after.
 * @returns {{ downs: Array<{key: string, index: number}>,
 *   ups: Array<{key: string, index: number}> }}
 */
export function diffDrags(
  previous, current
) {
  const downs = [];
  const ups = [];

  current.forEach( (
    index, key
  ) => {
    if ( !previous.has( key ) ) {
      downs.push( {
        key,
        index
      } );

      return;
    }

    const before = previous.get( key );

    if ( before !== index ) {
      ups.push( {
        key,
        index: before
      } );
      downs.push( {
        key,
        index
      } );
    }
  } );

  previous.forEach( (
    index, key
  ) => {
    if ( !current.has( key ) ) {
      ups.push( {
        key,
        index
      } );
    }
  } );

  return {
    downs,
    ups
  };
}
