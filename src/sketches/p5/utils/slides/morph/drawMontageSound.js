import animation from "../../animation.js";
import time from "../../time.js";
import resolveMontageSources from "./resolveMontageSources.js";
import {
  mapProgressionToSegment
} from "./segmentMapper.js";
import montageSound from "./montageSound.js";

/**
 * Drive the montage transition sound for the current slide. Runs once per frame
 * (post-draw) while a montage slide is active: it maps the loop progression to
 * the current segment, derives which variant is "arrived" (the one shown after
 * the segment midpoint — the same flip the dip and title ride), and hands it to
 * the polled scheduler, which fires a hit whenever that variant advances.
 *
 * No-op unless the slide is a montage with `sound.enabled` and at least two
 * resolved sources (fewer than two means nothing ever transitions).
 *
 * Named "draw*" to match its sibling overlays (drawMontageDip / drawMontage
 * Title), though it paints nothing — it schedules audio.
 */
export default function drawMontageSound(
  montageSlide, allSlides
) {
  const transition = montageSlide?.transition;
  const sound = transition?.sound;

  if ( !transition?.enabled || !sound?.enabled ) {
    return;
  }

  const sources = resolveMontageSources(
    montageSlide,
    allSlides
  );

  if ( sources.length < 2 ) {
    return;
  }

  const {
    fromIndex,
    toIndex,
    localT
  } = mapProgressionToSegment(
    animation.progression,
    sources.length,
    transition
  );

  // The arriving variant flips at the segment midpoint — matching the dip's
  // param snap and the title's label switch, so the hit lands with the visual.
  const activeIndex = localT < 0.5 ? fromIndex : toIndex;

  montageSound.update(
    time.seconds(),
    sound,
    {
      activeIndex,
      count: sources.length
    }
  );
}
