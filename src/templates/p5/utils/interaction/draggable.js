import events from "../events.js";
import sketch from "../sketch.js";
// pointerTracking, NOT ./index.js: this module is reachable from the core
// engine chain (slides/contentDrag.js), and the full interaction module would
// drag MediaPipe into module-eval (options.js loads it lazily on purpose).
import {
  getBasicPointerGroups,
  clientToCanvas
} from "./pointerTracking.js";
import {
  nearestTargetIndex,
  stepDrag
} from "./dragMath.js";

export {
  nearestTargetIndex,
  stepDrag
};

// ── Reusable grab → move → release drag layer ───────────────────────────────
// Extracted from splines-v2-draggable so any sketch (or engine layer, like the
// content-item drag in slides/contentDrag.js) can make on-canvas points
// draggable with the mouse, a finger, or any custom pointer (camera pinch, …)
// without re-implementing the state machine. What an instance handles:
//
//   - Pointer collection. Touch fingers and the mouse come from the shared
//     interaction layer (canvas-space, correct under viewport zoom/pan). Every
//     pointer is independent and keyed by a stable id, so several can drag at
//     once (one point per finger / per custom pointer). The mouse is ignored
//     while fingers are down — its position is stale on a touchscreen.
//   - Mouse press state via the engine's wired canvas events: press is
//     canvas-scoped (don't grab when clicking UI), release is global so
//     letting go off-canvas still ends a drag.
//   - The grab → move → release state machine itself: the nearest free target
//     within `radius` is grabbed on press, follows the pointer while pressed,
//     and is released when the pointer lifts or vanishes.
//   - Keeping drags off the viewport pan. While the mouse hovers/holds a
//     target the canvas carries `data-no-drag` (the viewport cancels a mouse
//     pan on that hook) plus a grab/grabbing cursor. Touch can't hover, so a
//     capture-phase pointerdown listener hit-tests the press BEFORE the
//     viewport's gesture layer sees it and tags the canvas in time — that way
//     touch dragging works even when the sketch didn't claim the touchscreen
//     through `interaction.touch`.

// Several draggable layers can be live on the same canvas at once (a sketch's
// own points plus the engine's content items), so the `data-no-drag` tag and
// the cursor reflect the union of every instance's wish, not the last writer.
const _instances = new Set();

function _applyAffordance() {
  const element = sketch.getCanvasElement?.();

  if ( !element ) {
    return;
  }

  let wantNoDrag = false;
  let grabbing = false;

  _instances.forEach( ( instance ) => {
    wantNoDrag = wantNoDrag || instance._wantNoDrag;
    grabbing = grabbing || instance._grabbing;
  } );

  if ( wantNoDrag ) {
    if ( !element.hasAttribute( "data-no-drag" ) ) {
      element.setAttribute(
        "data-no-drag",
        ""
      );
    }
  } else {
    element.removeAttribute( "data-no-drag" );
  }

  const cursor = grabbing ? "grabbing" : wantNoDrag ? "grab" : "";

  if ( element.style.cursor !== cursor ) {
    element.style.cursor = cursor;
  }
}

/**
 * Detach every live instance. Called at sketch start (registerContentDrag)
 * so an instance belonging to the PREVIOUS sketch can't leave a stale
 * `data-no-drag` / grab cursor on the fresh canvas — a sketch that stopped
 * drawing never gets another update() to clear its flags. Instances of the
 * new sketch re-attach afterwards (their setup runs later).
 */
export function detachAllDraggables() {
  [
    ..._instances
  ].forEach( ( instance ) => instance.detach() );
}

/**
 * Create a draggable layer. Call `attach()` from sketch setup (or any per-
 * sketch-start hook — the engine's event registry is cleared on reset, so the
 * listeners must be re-armed each start), then `update({...})` every frame.
 */
export function createDraggable() {
  const instance = {
    // Active drags: pointer key ("mouse" / "touch-<n>" / custom) → target index.
    drags: new Map(),
    // Mouse button state, fed by the engine's wired canvas events.
    mouseDown: false,
    // What this instance wants the canvas affordance to be (see above).
    _wantNoDrag: false,
    _grabbing: false,
    // Last frame's targets/radius, kept for the pointerdown capture hit-test.
    _lastTargets: [],
    _lastRadius: 0,
    _unregisters: [],
    _pointerDownListener: null,

    get dragging() {
      return instance.drags.size > 0;
    },

    /**
     * Arm the listeners. Idempotent per instance — safe to call on every
     * sketch start (it re-arms after events.registeredEvents was cleared).
     */
    attach() {
      instance.detach();

      // Press / release of the mouse button. Press is canvas-scoped (don't
      // grab when clicking UI); release is global so letting go off-canvas
      // still ends a drag.
      instance._unregisters.push( events.register(
        "engine-canvas-mouse-pressed",
        () => {
          instance.mouseDown = true;
        }
      ) );
      instance._unregisters.push( events.register(
        "engine-mouse-released",
        () => {
          instance.mouseDown = false;
        }
      ) );

      // Tag the canvas BEFORE the viewport's gesture layer sees the press:
      // its onDragStart cancels the pan when the event target carries
      // `data-no-drag` — the only chance a touch drag has, since touch can't
      // hover its way to the attribute like the mouse does. Capture phase runs
      // ahead of the viewport's bubble-phase handlers in the same dispatch.
      if ( typeof window !== "undefined" ) {
        instance._pointerDownListener = ( event ) => {
          if ( instance._lastTargets.length === 0 ) {
            return;
          }

          const element = sketch.getCanvasElement?.();

          if ( !element || event.target !== element ) {
            return;
          }

          const point = clientToCanvas(
            event.clientX,
            event.clientY
          );

          if ( !point ) {
            return;
          }

          const hit = nearestTargetIndex(
            instance._lastTargets,
            point.x,
            point.y,
            instance._lastRadius
          );

          if ( hit !== -1 ) {
            instance._wantNoDrag = true;
            _applyAffordance();
          }
        };
        window.addEventListener(
          "pointerdown",
          instance._pointerDownListener,
          {
            capture: true
          }
        );
      }

      _instances.add( instance );
    },

    detach() {
      instance._unregisters.forEach( ( unregister ) => unregister() );
      instance._unregisters = [];

      if ( instance._pointerDownListener && typeof window !== "undefined" ) {
        window.removeEventListener(
          "pointerdown",
          instance._pointerDownListener,
          {
            capture: true
          }
        );
        instance._pointerDownListener = null;
      }

      instance.drags.clear();
      instance.mouseDown = false;
      instance._wantNoDrag = false;
      instance._grabbing = false;
      instance._lastTargets = [];
      _instances.delete( instance );
    },

    /**
     * Nothing to drag this frame (e.g. every item was removed): drop any
     * in-flight drags and clear this instance's share of the canvas
     * affordance without detaching the listeners.
     */
    idle() {
      instance.drags.clear();
      instance._lastTargets = [];

      if ( instance._wantNoDrag || instance._grabbing ) {
        instance._wantNoDrag = false;
        instance._grabbing = false;
        _applyAffordance();
      }
    },

    /**
     * Run one frame of the drag layer.
     *
     * @param {object} config
     * @param {Array<{x: number, y: number}>} config.targets - Pixel-space
     *   grab targets. `onMove` may mutate entries in place so later pointers
     *   in the same frame see updated positions.
     * @param {number} [config.radius=44] - Pick-up radius (px).
     * @param {(index: number, pointer: object) => void} config.onMove -
     *   Called for every grabbed target that follows its pointer this frame.
     * @param {Array} [config.groups] - Pre-fetched getPointerGroups() result.
     *   Pass it when the sketch already collects groups (avoids re-running
     *   per-frame collectors); omitted, mouse + touch are collected with the
     *   basic always-on config.
     * @param {Array<{key, x, y, pressed, kind}>} [config.extraPointers] -
     *   Custom pointers merged in (e.g. camera pinches), one drag each.
     * @returns {{ hovers: Set<number>, grabbed: Set<number>,
     *   released: boolean, dragging: boolean, pointers: Array }}
     */
    update( {
      targets,
      radius = 44,
      onMove,
      groups = null,
      extraPointers = []
    } ) {
      const pointerGroups = groups ?? getBasicPointerGroups();
      const pointers = [];
      const touchGroups = pointerGroups.filter( ( group ) => group.source === "touch" );

      touchGroups.forEach( ( group ) => {
        pointers.push( {
          key: group.id,
          x: group.points[ 0 ].x,
          y: group.points[ 0 ].y,
          pressed: true,
          kind: "touch"
        } );
      } );

      // The mouse is dropped while any finger is down (its position is stale
      // on a touchscreen).
      if ( touchGroups.length === 0 ) {
        const mouse = pointerGroups.find( ( group ) => group.source === "mouse" );

        if ( mouse ) {
          pointers.push( {
            key: "mouse",
            x: mouse.points[ 0 ].x,
            y: mouse.points[ 0 ].y,
            pressed: instance.mouseDown,
            kind: "mouse"
          } );
        }
      }

      pointers.push( ...extraPointers );

      const {
        hovers,
        grabbed,
        released
      } = stepDrag(
        instance.drags,
        pointers,
        targets,
        radius,
        onMove
      );

      // Mouse-only affordance: keep the canvas off the viewport pan while the
      // mouse hovers/holds a target, and mirror the grab in the cursor. Any
      // active drag (touch included) keeps the tag on so a pan can't start
      // mid-drag.
      const mousePointer = pointers.find( ( pointer ) => pointer.kind === "mouse" );
      const mouseDragging = instance.drags.has( "mouse" );
      const mouseOverTarget = !!mousePointer && !mouseDragging && nearestTargetIndex(
        targets,
        mousePointer.x,
        mousePointer.y,
        radius
      ) !== -1;

      instance._wantNoDrag = mouseDragging || mouseOverTarget || instance.drags.size > 0;
      instance._grabbing = mouseDragging;
      _applyAffordance();

      instance._lastTargets = targets;
      instance._lastRadius = radius;

      return {
        hovers,
        grabbed,
        released,
        dragging: instance.drags.size > 0,
        pointers
      };
    }
  };

  return instance;
}
