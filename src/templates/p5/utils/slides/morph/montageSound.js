import audio from "../../audio.js";

/**
 * Turns montage variant changes into sound through the sketch audio engine.
 * A montage cycles deterministically off the loop progression; the arriving
 * variant flips at each segment midpoint (where the dip peaks and the title
 * switches). This scheduler watches that "active variant" index and fires a
 * hit — the audible counterpart of the visual switch — every time it advances.
 *
 * Because everything routes through `audio.trigger("click", …)`, a hit that
 * plays live while editing is also logged during deterministic capture and
 * baked into the exported video's soundtrack.
 *
 * Scheduling is polled, not timer-based: `drawMontageSound` calls
 * `update(now, option, meta)` once per frame with the sketch clock
 * (`time.seconds()`), so a due hit fires on a real frame — which is exactly
 * what keeps it deterministic when the recorder steps frames faster or slower
 * than the wall clock.
 *
 * Behaviour knobs come from the transition's `sound` options
 * (SlideTransitionSoundSchema):
 *   - `slidePitchSpread` gives each arriving variant its own note;
 *   - `pitchVariation` humanises the pitch per transition;
 *   - `repeat` turns one change into an N-hit burst with an optional pitch ramp.
 */

const DEFAULTS = {
  preset: "blip",
  volume: 0.5,
  pitch: 1,
  pitchVariation: 0,
  slidePitchSpread: 0
};

export function createMontageSoundScheduler(
  trigger = ( params ) => audio.trigger(
    "click",
    params
  ),
  random = Math.random
) {
  // Pending hits: { at, preset, gain, rate }.
  let queue = [];
  // Active variant index observed on the previous frame. null until the first
  // frame is seen so the montage never "clicks" the instant it appears.
  let lastActiveIndex = null;
  // Backwards-clock detection (capture restart, deck reset, loop wrap handled
  // separately since a wrap is a legitimate transition).
  let lastNow = -Infinity;

  const reset = () => {
    queue = [];
    lastActiveIndex = null;
    lastNow = -Infinity;
  };

  // 2^x pitch algebra keeps every knob musical (octaves, not raw Hz).
  const computeRate = (
    option, activeIndex, count, repeatIndex, pitchStep
  ) => {
    const spread = option.slidePitchSpread ?? DEFAULTS.slidePitchSpread;
    const variation = option.pitchVariation ?? DEFAULTS.pitchVariation;
    const slideOffset =
      count > 1 ? spread * ( activeIndex / ( count - 1 ) ) : 0;
    const humanize = ( random() * 2 - 1 ) * variation * 0.5;
    const ramp = pitchStep * repeatIndex;

    return (
      ( option.pitch ?? DEFAULTS.pitch ) *
      Math.pow(
        2,
        slideOffset + humanize + ramp
      )
    );
  };

  const enqueueTransition = (
    option, activeIndex, count, now
  ) => {
    const repeat = option.repeat ?? {
      mode: "once"
    };
    // [offset seconds, repeat index] pairs for this transition's hit series.
    let series = [
      [
        0,
        0
      ]
    ];
    let pitchStep = 0;

    if ( repeat.mode === "count" ) {
      const times = repeat.times ?? 3;
      const interval = repeat.interval ?? 0.06;

      pitchStep = repeat.pitchStep ?? 0;
      series = Array.from(
        {
          length: times
        },
        (
          _, i
        ) => [
          i * interval,
          i
        ]
      );
    }

    for ( const [
      offset,
      repeatIndex
    ] of series ) {
      queue.push( {
        at: now + offset,
        preset: option.preset ?? DEFAULTS.preset,
        gain: option.volume ?? DEFAULTS.volume,
        rate: computeRate(
          option,
          activeIndex,
          count,
          repeatIndex,
          pitchStep
        )
      } );
    }
  };

  const fireDue = ( now ) => {
    if ( !queue.length ) {
      return;
    }

    // Hits that went stale while the montage wasn't drawn (hidden tab, fade
    // window) are dropped, not fired: releasing them all in one frame would
    // stack into a single loud transient.
    const staleBefore = now - 0.25;
    const due = queue.filter( ( hit ) => hit.at <= now && hit.at >= staleBefore );

    queue = queue.filter( ( hit ) => hit.at > now );

    for ( const hit of due ) {
      trigger( {
        preset: hit.preset,
        gain: hit.gain,
        rate: hit.rate
      } );
    }
  };

  return {
    reset,

    /**
     * Poll one frame. `now` is the sketch clock in seconds; `activeIndex` is
     * the variant currently arrived (segment flip), `count` the number of
     * montage sources. Fires a transition hit whenever `activeIndex` advances.
     */
    update(
      now, option, {
        activeIndex, count
      } = {}
    ) {
      // The sketch clock resets on capture start / deck reset. Any state keyed
      // to the old timeline would mis-fire (or silence) every future hit; drop
      // the change baseline so the restart doesn't read as a transition.
      if ( now + 0.5 < lastNow ) {
        reset();
      }

      lastNow = now;

      if (
        Number.isInteger( activeIndex ) &&
        activeIndex !== lastActiveIndex
      ) {
        // Skip the very first observation: appearing on a montage slide is not
        // itself a transition.
        if ( lastActiveIndex !== null ) {
          enqueueTransition(
            option,
            activeIndex,
            count ?? 1,
            now
          );
        }

        lastActiveIndex = activeIndex;
      }

      fireDue( now );
    },

    /** Number of queued hits (test / debug seam). */
    pending() {
      return queue.length;
    }
  };
}

// Shared instance for the montage overlay renderer. Module scope is fine: only
// the current slide is ever a montage at a time, so a single active-variant
// tracker is correct.
export default createMontageSoundScheduler();
