// ── A hit at each scene change ──────────────────────────────────────────────
//
// The montage's polled scheduler (slides/morph/montageSound.js) already turns
// "the active index advanced" into a burst through the sketch audio engine,
// deterministic in a capture. A sequence reuses it as is, one scheduler per
// sequence item: the index it watches is the scene being entered, so the hit
// lands as the cut begins.

import {
  createMontageSoundScheduler
} from "../slides/morph/montageSound.js";

const schedulers = new Map();

/**
 * Poll one frame for the sequence at `key`.
 *
 * @param {string} key the sequence item's layer key
 * @param {object} sound the item's SlideTransitionSoundSchema value
 * @param {{ activeIndex: number, count: number }} meta
 * @param {number} now the sketch clock, seconds
 */
export function updateSequenceSound(
  key, sound, meta, now
) {
  if ( !sound?.enabled ) {
    return;
  }

  let scheduler = schedulers.get( key );

  if ( !scheduler ) {
    scheduler = createMontageSoundScheduler();
    schedulers.set(
      key,
      scheduler
    );
  }

  scheduler.update(
    now,
    sound,
    meta
  );
}

export function disposeSequenceSound() {
  schedulers.clear();
}
