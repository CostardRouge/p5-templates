import audio from "@/p5/utils/audio.js";
import audioAssets from "@/p5/utils/audioAssets.js";
import {
  hoverSoundFormValues
} from "./hoverSoundOptions.js";

/**
 * The sound of a fly-by: v10's cursors never press anything, so the click
 * pair of the drag-based sketches (see @/p5/utils/interaction/dragClicks.js)
 * collapses into a single "on over" moment — the frame a cursor's hover
 * circle first touches a text point. The sketch does the proximity work and
 * hands this layer the rising edges only; one batch per frame, equal-power
 * summed and voice-capped exactly like the click layer, so a formation
 * crossing a whole word reads as a flurry, not a comb filter.
 *
 * Everything goes through the sketch audio engine (`audioAssets` /
 * `audio.trigger`), so an uploaded sound is heard live, mixed into a
 * realtime recording, and rendered sample-accurately into a deterministic
 * capture. With the shipped defaults the layer is SILENT — both the asset
 * field and the synth fallback are empty on purpose (the right fly-by sound
 * is still being chosen); it starts speaking the moment a file lands on the
 * "On over" field.
 */

// The form block is the single source of truth for the defaults, so a sketch
// that omits the options entirely behaves exactly like the shipped form.
const DEFAULTS = hoverSoundFormValues;

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
 * Create the hover-sound layer.
 *
 * Usage — once per frame, after the proximity pass:
 *
 *   const overs = createHoverSounds();     // module scope
 *   overs.reset();                         // sketch.setup
 *   overs.update( enterCount, o.sound );   // sketch.draw
 */
export function createHoverSounds() {
  return {
    /**
     * @param {number} enterCount - How many (cursor, point) pairs newly came
     *   into hover range this frame (rising edges only).
     * @param {object} [config] - The sound options block (see DEFAULTS).
     */
    update(
      enterCount, config
    ) {
      const cfg = {
        ...DEFAULTS,
        ...( config ?? {} )
      };

      // Keep the uploaded sound decoded (no-op once loaded), even while
      // muted — flipping `enabled` on should be audible immediately.
      audioAssets.sync( [
        cfg.over
      ] );

      if ( cfg.enabled === false || !enterCount ) {
        return;
      }

      const count = Math.min(
        enterCount,
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
      const hasSample = audioAssets.ready( cfg.over );

      if ( !hasSample && !cfg.fallback ) {
        return;
      }

      for ( let i = 0; i < count; i++ ) {
        // Detune by voice slot, not by frame or clock: a given batch of
        // simultaneous fly-bys sounds identical in the preview and in a capture.
        const rate = 1 + ( ( i % 3 ) - 1 ) * cfg.spread;

        if ( hasSample ) {
          audioAssets.play(
            cfg.over,
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
    },

    /** Re-arm the asset sync (sketch restart). */
    reset() {
      audioAssets.reset();
    }
  };
}
