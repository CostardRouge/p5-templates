import {
  getP5
} from "../sketch.js";
import {
  stepPinch
} from "./pinchMath.js";

export {
  fingertipsOf
} from "./pinchMath.js";

// ── Reusable multi-hand pinch layer ─────────────────────────────────────────
// Companion of the draggable layer (draggable.js): where that module turns
// mouse/touch into grab pointers, this one turns camera-tracked HANDS into
// them — pinch thumb + index and the hand becomes a pressed pointer for
// draggable.update's `extraPointers`. Every tracked hand is independent, so
// several hands can each drag their own point at the same time.
//
// The tracker is deliberately fed hand GROUPS, not the camera: anything shaped
// `{ id, points }` with the MediaPipe fingertip ordering works. That is the
// seam the planned "virtual hands" build on — pre-recorded hand clips replayed
// as the same group shape will pinch, drag and render exactly like live hands,
// and a sketch can mix both in one update call. The math lives in
// pinchMath.js; this wrapper owns the per-hand state and the on-canvas
// feedback.

/**
 * Create a pinch tracker. Call `update(handGroups, config)` every frame and
 * feed the returned pointers to draggable.update; call `draw()` after the
 * scene so every tracked hand shows its thumb/index markers (accented while
 * pinching). `clear()` from sketch setup so a restart forgets stale hands.
 */
export function createPinchTracker() {
  const state = {
    hands: new Map(),
    smooth: new Map(),
    latch: new Map()
  };

  return {
    // Live per-hand feedback, keyed by group id: { thumb, index, mid,
    // pinching }. Exposed so sketches can drive their own visuals from it.
    hands: state.hands,

    /**
     * One frame of pinch resolution over every hand-shaped group.
     *
     * @param {Array<{ id, points }>} groups - hand groups (live + virtual).
     * @param {object} [config] - { pinch, smoothing, releaseRatio }, see
     *   stepPinch.
     * @returns {Array} pointers for draggable.update's `extraPointers`.
     */
    update(
      groups, config
    ) {
      return stepPinch(
        state,
        groups,
        config
      );
    },

    /**
     * Thumb + index markers and the connector for EVERY tracked hand, accented
     * while pinching, so the user can see what the camera tracks and when a
     * grab engages. No-op while no hand is tracked.
     */
    draw( {
      idleColor = [
        255,
        255,
        255
      ],
      activeColor = [
        120,
        200,
        255
      ]
    } = {} ) {
      if ( state.hands.size === 0 ) {
        return;
      }

      const p = getP5();

      p.push();

      state.hands.forEach( ( hand ) => {
        const color = hand.pinching ? activeColor : idleColor;

        p.stroke(
          ...color,
          hand.pinching ? 230 : 120
        );
        p.strokeWeight( hand.pinching ? 4 : 2 );
        p.line(
          hand.thumb.x,
          hand.thumb.y,
          hand.index.x,
          hand.index.y
        );

        p.noStroke();
        p.fill(
          ...color,
          220
        );
        p.circle(
          hand.thumb.x,
          hand.thumb.y,
          16
        );
        p.circle(
          hand.index.x,
          hand.index.y,
          16
        );
        p.fill(
          ...color,
          hand.pinching ? 255 : 120
        );
        p.circle(
          hand.mid.x,
          hand.mid.y,
          hand.pinching ? 14 : 8
        );
      } );

      p.pop();
    },

    /** Forget every tracked hand (sketch restart). */
    clear() {
      state.hands.clear();
      state.smooth.clear();
      state.latch.clear();
    }
  };
}
