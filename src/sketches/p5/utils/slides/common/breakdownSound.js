import {
  createSpecsSoundScheduler
} from "./specsSound.js";

/**
 * Sound-on-change for the breakdown overlay. The breakdown narrates a diff one
 * step at a time; each animated parameter LOCKS into its final value at a
 * scheduled point in the loop. This turns every such lock into a click through
 * the shared specs sound scheduler — so a breakdown audibly clicks its way to
 * the settled sketch, group by group, and (because it routes through
 * `audio.trigger("click", …)` like every other feedback sound) the clicks are
 * logged during deterministic capture and baked into the exported video.
 *
 * "Change" here means a leaf's eased progress crossing to 1 (locked). Detection
 * is a per-path edge: prev < 1 → now >= 1. First sightings never fire — a leaf
 * that is already locked when first seen (a past step, or the baseline frame
 * after a loop wrap) never animated — so the intro stays clean and the loop
 * re-fires each pass as the values relock. The scheduler owns the staggering,
 * per-line cooldown, burst cap and repeat modes: identical knobs to the specs
 * sound panel, driven by the same SpecsSoundSchema options.
 */

export function createBreakdownSoundScheduler( scheduler = createSpecsSoundScheduler() ) {
  // path -> last eased progress seen (lock-edge detection).
  let lastT = new Map();
  // Backwards-clock detection (capture restart, deck reset).
  let lastNow = -Infinity;

  const reset = () => {
    scheduler.reset();
    lastT = new Map();
    lastNow = -Infinity;
  };

  return {
    reset,

    /**
     * Click for every leaf that locked on THIS frame, then flush due clicks.
     * Call once per drawn frame.
     *
     * @param {object} sound  The breakdown item's `sound` options (SpecsSoundSchema).
     * @param {object} args
     * @param {{ paths: string[] }[]} args.animSteps  Ordered steps; their flat
     *   leaf list gives each path a stable index/count for `linePitchSpread`.
     * @param {Map<string, number>} args.leafT  path -> eased progress (0..1).
     * @param {number} args.now  Sketch clock in seconds (`time.seconds()`).
     */
    noteFrame(
      sound, {
        animSteps, leafT, now
      }
    ) {
      // A capture restart / deck reset rewinds the sketch clock; drop stale
      // edge state so the first post-reset frame only rebaselines (no click).
      if ( now + 0.5 < lastNow ) {
        reset();
      }

      lastNow = now;

      // Flat, ordered leaf list: index + total drive the pitch spread across
      // the WHOLE breakdown (earlier steps sit at one end of the gradient).
      const paths = [];

      for ( const step of animSteps ) {
        for ( const path of step.paths ) {
          paths.push( path );
        }
      }

      const lineCount = paths.length;

      paths.forEach( (
        path, index
      ) => {
        const t = leafT.get( path ) ?? 1;
        const prev = lastT.get( path );

        lastT.set(
          path,
          t
        );

        // Fire only on the lock EDGE, and never on a first sighting (prev
        // undefined) — a leaf already at 1 when first seen never animated.
        if ( prev !== undefined && prev < 1 && t >= 1 ) {
          scheduler.noteChange(
            sound,
            {
              label: path,
              index,
              lineCount,
              now
            }
          );
        }
      } );

      scheduler.update( now );
    },

    /** Number of queued clicks (test / debug seam). */
    pending() {
      return scheduler.pending();
    }
  };
}

// Shared instance for the breakdown overlay renderer. Module scope mirrors
// specsSound: the breakdown is in practice a single item.
export default createBreakdownSoundScheduler();
