import audio from "../audio.js";
import audioAssets from "../audioAssets.js";
import {
  dragClickFormValues
} from "./dragClickOptions.js";
import {
  diffDrags
} from "./dragMath.js";

/**
 * Click feedback for a draggable layer: the sound of a mouse button.
 *
 * A drag has two audible moments — the button going DOWN when a pointer
 * grabs a handle, and coming back UP when it lets go — so the layer takes two
 * separate sounds. Uploaded audio assets (an `asset` field of kind `audios`)
 * are used when present; otherwise a built-in synth preset stands in, so the
 * feedback is audible before anything is uploaded.
 *
 * It listens to the drag layer's own state rather than to raw pointer events,
 * which is what makes it source-agnostic: a mouse press, a finger, a camera
 * pinch and a scripted virtual pointer all click the moment they actually take
 * hold of a handle — and never when a press lands on empty canvas.
 *
 * Everything goes through `audio.trigger`, so the clicks are heard live, mixed
 * into a realtime recording, and rendered sample-accurately into a
 * deterministic capture.
 */

// The form block is the single source of truth for the defaults, so a sketch
// that omits the options entirely behaves exactly like the shipped form.
const DEFAULTS = dragClickFormValues;

/** Pointer keys the virtual-pointer troupes use (see each sketch's module). */
const VIRTUAL_PREFIX = "vp-";

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

/**
 * Play one batch of simultaneous clicks.
 *
 * @param {Array<{key: string, index: number}>} events
 * @param {string} path - Asset path for this edge ("" → synth fallback).
 * @param {object} cfg - Resolved config.
 */
function fire(
  events, path, cfg
) {
  if ( events.length === 0 ) {
    return;
  }

  const count = Math.min(
    events.length,
    Math.max(
      1,
      Math.round( cfg.maxVoices )
    )
  );
  // Equal-power-ish sum: N copies of one sample would otherwise be N× louder.
  const gain = clamp(
    cfg.volume,
    0,
    1
  ) / Math.sqrt( count );
  const hasSample = audioAssets.ready( path );

  if ( !hasSample && !cfg.fallback ) {
    return;
  }

  for ( let i = 0; i < count; i++ ) {
    // Detune by voice slot, not by frame or clock: a given batch of
    // simultaneous clicks sounds identical in the preview and in a capture.
    const rate = 1 + ( ( i % 3 ) - 1 ) * cfg.spread;

    if ( hasSample ) {
      audioAssets.play(
        path,
        {
          gain,
          playbackRate: rate
        }
      );
    } else {
      audio.trigger(
        "click",
        {
          preset: cfg.fallback,
          gain,
          rate
        }
      );
    }
  }
}

/**
 * Create a click layer for one draggable instance.
 *
 * Usage — once per frame, right after the drag layer ran:
 *
 *   const clicks = createDragClicks();          // module scope
 *   clicks.reset();                             // sketch.setup
 *   draggable.update( { … } );
 *   clicks.update( draggable.drags, o.sound );  // sketch.draw
 */
export function createDragClicks() {
  let previous = new Map();

  return {
    /**
     * @param {Map<string, number>} drags - `draggable.drags`, live.
     * @param {object} [config] - The sound options block (see DEFAULTS).
     */
    update(
      drags, config
    ) {
      const cfg = {
        ...DEFAULTS,
        ...( config ?? {} )
      };

      // Keep the uploaded sounds decoded (no-op once loaded), even while
      // muted — flipping `enabled` on should click immediately.
      audioAssets.sync( [
        cfg.down,
        cfg.up
      ] );

      const current = drags instanceof Map ? drags : new Map();

      if ( cfg.enabled === false ) {
        previous = new Map( current );

        return;
      }

      const {
        downs,
        ups
      } = diffDrags(
        previous,
        current
      );

      previous = new Map( current );

      const keep = ( event ) => cfg.virtual !== false || !event.key.startsWith( VIRTUAL_PREFIX );

      fire(
        downs.filter( keep ),
        cfg.down,
        cfg
      );
      fire(
        ups.filter( keep ),
        cfg.up,
        cfg
      );
    },

    /** Forget the held handles (sketch restart) — no phantom release click. */
    reset() {
      previous = new Map();
      audioAssets.reset();
    }
  };
}

export {
  DEFAULTS as DRAG_CLICK_DEFAULTS, VIRTUAL_PREFIX as DRAG_CLICK_VIRTUAL_PREFIX
};
