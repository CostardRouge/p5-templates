import audio from "../../audio.js";

/**
 * Turns specs-overlay value changes into clicks through the sketch audio
 * engine. Because everything routes through `audio.trigger("click", …)`, a
 * click that plays live while editing is also logged during deterministic
 * capture and baked into the exported video's soundtrack.
 *
 * Scheduling is polled, not timer-based: `drawSlideSpecs` calls `update(now)`
 * once per frame with the sketch clock (`time.seconds()`), so due clicks fire
 * on real frames — which is exactly what keeps them deterministic when the
 * recorder steps frames faster or slower than the wall clock.
 *
 * Behaviour knobs all come from the specs item's `sound` options
 * (SpecsSoundSchema):
 *   - simultaneous changes are STAGGERED by `minInterval` (slot-machine
 *     cascade) instead of stacking into one transient;
 *   - a line that keeps changing every frame (montage morph) retriggers at
 *     most once per `lineCooldown`;
 *   - the queue is capped at `maxBurst` pending clicks;
 *   - `repeat` turns one change into a burst ("count", with per-repeat pitch
 *     ramp) or a Geiger-style stream ("while-highlighted").
 */

const DEFAULTS = {
  preset: "click",
  volume: 0.5,
  pitch: 1,
  pitchVariation: 0.1,
  linePitchSpread: 0,
  minInterval: 0.05,
  lineCooldown: 0.15,
  maxBurst: 12
};

export function createSpecsSoundScheduler(
  trigger = ( params ) => audio.trigger(
    "click",
    params
  ),
  random = Math.random
) {
  // Pending clicks: { at, preset, gain, rate }, kept sorted by insertion —
  // near enough, fire order only matters within a frame anyway.
  let queue = [];
  // Stagger anchor: the time the latest initial click was scheduled at.
  let lastScheduledAt = -Infinity;
  // label -> sketch time of its last accepted change (cooldown gate).
  const lineLastChangeAt = new Map();
  // Backwards-clock detection (capture restart, deck reset).
  let lastNow = -Infinity;

  const reset = () => {
    queue = [];
    lastScheduledAt = -Infinity;
    lineLastChangeAt.clear();
    lastNow = -Infinity;
  };

  // 2^x pitch algebra keeps every knob musical (octaves, not raw Hz).
  const computeRate = (
    option, index, lineCount, repeatIndex, pitchStep
  ) => {
    const spread = option.linePitchSpread ?? DEFAULTS.linePitchSpread;
    const variation = option.pitchVariation ?? DEFAULTS.pitchVariation;
    const lineOffset =
      lineCount > 1 ? spread * ( index / ( lineCount - 1 ) ) : 0;
    const humanize = ( random() * 2 - 1 ) * variation * 0.5;
    const ramp = pitchStep * repeatIndex;

    return (
      ( option.pitch ?? DEFAULTS.pitch ) *
      Math.pow(
        2,
        lineOffset + humanize + ramp
      )
    );
  };

  const syncClock = ( now ) => {
    // The sketch clock resets on capture start / deck reset. Any state keyed
    // to the old timeline would silence (or mis-time) every future click.
    if ( now + 0.5 < lastNow ) {
      reset();
    }

    lastNow = now;
  };

  return {
    reset,

    /**
     * Register one changed line. `now` is the sketch clock in seconds;
     * `highlightDuration` bounds the "while-highlighted" repeat mode.
     */
    noteChange(
      option, {
        label, index, lineCount, now, highlightDuration = 0.9
      }
    ) {
      syncClock( now );

      const cooldown = option.lineCooldown ?? DEFAULTS.lineCooldown;
      const lastChange = lineLastChangeAt.get( label );

      if ( lastChange !== undefined && now - lastChange < cooldown ) {
        return;
      }

      lineLastChangeAt.set(
        label,
        now
      );

      const minInterval = option.minInterval ?? DEFAULTS.minInterval;
      const maxBurst = option.maxBurst ?? DEFAULTS.maxBurst;
      const firstAt = Math.max(
        now,
        lastScheduledAt + minInterval
      );

      lastScheduledAt = firstAt;

      const repeat = option.repeat ?? {
        mode: "once"
      };
      // [offset seconds, repeat index] pairs for this change's click series.
      let series = [
        [
          0,
          0
        ]
      ];
      let pitchStep = 0;

      if ( repeat.mode === "count" ) {
        const times = repeat.times ?? 3;
        const interval = repeat.interval ?? 0.08;

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
      } else if ( repeat.mode === "while-highlighted" ) {
        const interval = repeat.interval ?? 0.12;
        const count = Math.max(
          1,
          Math.floor( highlightDuration / interval ) + 1
        );

        series = Array.from(
          {
            length: count
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
        if ( queue.length >= maxBurst ) {
          break;
        }

        queue.push( {
          at: firstAt + offset,
          preset: option.preset ?? DEFAULTS.preset,
          gain: option.volume ?? DEFAULTS.volume,
          rate: computeRate(
            option,
            index,
            lineCount,
            repeatIndex,
            pitchStep
          )
        } );
      }
    },

    /** Fire every queued click that is due. Call once per drawn frame. */
    update( now ) {
      syncClock( now );

      if ( !queue.length ) {
        return;
      }

      // Clicks that went stale while the overlay wasn't drawn (fade-out
      // window, hidden tab) are dropped, not fired: releasing them all in
      // one frame would stack into a single loud transient.
      const staleBefore = now - 0.25;
      const due = queue.filter( ( click ) => click.at <= now && click.at >= staleBefore );

      queue = queue.filter( ( click ) => click.at > now );

      for ( const click of due ) {
        trigger( {
          preset: click.preset,
          gain: click.gain,
          rate: click.rate
        } );
      }
    },

    /** Number of queued clicks (test / debug seam). */
    pending() {
      return queue.length;
    }
  };
}

// Shared instance for the specs overlay renderer. Like the change tracker in
// specsChanges.js, module scope is fine: specs is in practice a single item.
export default createSpecsSoundScheduler();
