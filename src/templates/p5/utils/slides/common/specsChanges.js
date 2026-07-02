// Tracks per-label value changes for the specs overlay so the renderer can
// temporarily highlight whichever line just changed.
//
// Keyed by line label at module scope: the specs overlay is typically a single
// item, and labels (RESOLUTION, BACKGROUND.COLUMNS, ...) are unique within it.
// Heat decays on the real wall clock so the highlight fades during playback and
// reflects the latest change even on a one-off redraw while editing.

const tracker = new Map();

/**
 * Compute a 0..1 "heat" for each line, where 1 means it just changed and 0
 * means it has settled (or never changed). The first time a label is seen it is
 * registered without flashing, so the initial boot reveal stays clean.
 *
 * @param {{ label: string, value: string }[]} lines
 * @param {number} durationSeconds  How long a highlight takes to fade out.
 * @param {(label: string, index: number) => void} [onChange]  Called once per
 *   line whose value just changed on THIS call (not for first sightings) —
 *   the seam the sound feedback hangs off.
 * @returns {Map<string, number>} label -> heat (0..1)
 */
export default function computeSpecsHeats(
  lines, durationSeconds, onChange
) {
  const now = performance.now();
  const durationMs = Math.max(
    1,
    durationSeconds * 1000
  );
  const heats = new Map();

  for ( let index = 0; index < lines.length; index++ ) {
    const {
      label, value
    } = lines[ index ];
    const previous = tracker.get( label );

    if ( previous === undefined ) {
      // First sighting: remember the value but don't treat it as a change.
      tracker.set(
        label,
        {
          value,
          changedAt: -Infinity
        }
      );
    } else if ( previous.value !== value ) {
      previous.value = value;
      previous.changedAt = now;
      onChange?.(
        label,
        index
      );
    }

    const entry = tracker.get( label );
    const age = now - entry.changedAt;
    const heat = age >= durationMs ? 0 : 1 - age / durationMs;

    heats.set(
      label,
      heat
    );
  }

  return heats;
}
