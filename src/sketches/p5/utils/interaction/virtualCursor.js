import cache from "../cache.js";
import sketch, {
  getP5
} from "../sketch.js";
import {
  stepCursors,
  CURSOR_POINTING
} from "./virtualCursorMath.js";

// ── Reusable virtual-pointer layer ──────────────────────────────────────────
// The companion of draggable.js (mouse/touch → grabs) and handPinch.js (camera
// hands → grabs): this one gives those pointers a FACE. The OS cursor is hidden
// over the canvas and replaced by an artwork drawn INTO the sketch, swapped by
// what the pointer is doing — a pointing hand while free, an open hand over a
// grabbable target, a closed hand while actually dragging one.
//
// Why: hand tracking is the destination, but it is fragile and leaves nothing
// behind in an export. Driving the same grab → move → release path with a mouse
// while it LOOKS like a hand lets the interaction be built and judged now, and
// is the seam the planned pre-recorded "virtual hands" plug into — anything
// emitting `{ key, x, y, pressed, kind }` pointers draws through this layer.
//
// The three artworks are ordinary `image` options (same asset field as the
// photo sketches), so the options module loads them into the shared images
// cache and we just read them here. A state whose image is missing or still
// decoding falls back to the pointing artwork, so the pointer is never
// invisible.

// Where the artwork sits relative to the pointer, normalized within the image:
// the pointing hand's index fingertip. The same anchor is used for all three
// states — the hand then stays put and only its fingers change, instead of the
// whole cursor jumping when it opens or closes.
const HOTSPOT_X = 0.414;
const HOTSPOT_Y = 0.25;

// Drawn width as a fraction of the canvas's short side, so the cursor keeps its
// on-screen weight at any canvas size (the artworks themselves are small — the
// shipped icons are 32×32 — and would be near-invisible at natural size).
const SIZE_RATIO = 0.09;

// A loaded p5.Image for an options image path, or null while it is still
// decoding / missing. The options module owns the loading: it collects every
// image-looking string under `sketch.*` (SVG included) into this cache.
function loadedImage( path ) {
  const img = cache.get( "imagesMap" )?.get?.( path )?.img;

  return img?.width ? img : null;
}

/**
 * Create a virtual-pointer layer. Call `update(pointers, {...})` every frame
 * with the drag layer's pointers, then `draw(images)` after the scene so the
 * cursors stack on top. `clear()` from sketch setup so a restart forgets stale
 * pointers and gives the system cursor back.
 */
export function createVirtualCursor() {
  const state = {
    positions: new Map()
  };
  let cursors = [];
  let hidden = false;

  function hideSystemCursor( hide ) {
    const element = sketch.getCanvasElement?.();

    if ( !element ) {
      return;
    }

    // The drag layer writes `grab` / `grabbing` into the same property during
    // its own update; this runs later in the frame, so "none" is what the
    // browser paints.
    if ( hide ) {
      element.style.cursor = "none";
      hidden = true;
    } else if ( hidden ) {
      element.style.cursor = "";
      hidden = false;
    }
  }

  return {
    /** Resolved cursors of the last update — { key, kind, x, y, state }. */
    get cursors() {
      return cursors;
    },

    /**
     * One frame of state resolution.
     *
     * @param {Array} pointers - Drag-layer pointers (`draggable.update()`
     *   returns them; filter to the kinds you want a cursor for).
     * @param {object} params - `{ drags, targets, radius, smoothing }`. Pass
     *   the drag layer's own `drags` map and this frame's targets/radius so the
     *   icon always agrees with what is actually grabbable.
     */
    update(
      pointers, params
    ) {
      cursors = stepCursors(
        state,
        pointers ?? [],
        params
      );

      return cursors;
    },

    /**
     * Draw the resolved cursors.
     *
     * @param {{ pointing: string, open: string, grabbing: string }} [images] -
     *   The sketch's three image option values.
     */
    draw( images ) {
      if ( cursors.length === 0 ) {
        hideSystemCursor( false );

        return;
      }

      const p = getP5();
      const width = Math.min(
        p.width,
        p.height
      ) * SIZE_RATIO;

      hideSystemCursor( true );
      p.push();
      p.imageMode( p.CORNER );
      p.noStroke();

      cursors.forEach( ( cursor ) => {
        const img = loadedImage( images?.[ cursor.state ] )
          ?? loadedImage( images?.[ CURSOR_POINTING ] );

        if ( !img ) {
          return;
        }

        const height = width * ( img.height / img.width );

        p.image(
          img,
          cursor.x - HOTSPOT_X * width,
          cursor.y - HOTSPOT_Y * height,
          width,
          height
        );
      } );

      p.pop();
    },

    /** Forget every pointer and give the system cursor back (sketch restart). */
    clear() {
      state.positions.clear();
      cursors = [];
      hideSystemCursor( false );
    }
  };
}
