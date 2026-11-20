/**
 * The free slots the plan fills: the rhythm's, week by week, by the gallery's
 * own rule (`freeSlots`: in the future, no post within the slot's window, no
 * live post that day — EVERY post of the account counts, another app's too).
 */

import {
  addDays, freeSlots
} from "../gallery/calendar";
import {
  weekOf, type Rhythm
} from "../postiz/rhythm";
import {
  PLAN_WEEKS
} from "./planner";

export function planFreeSlots(
  rhythm: Rhythm,
  posts: readonly { publishDate: string;
    state: string }[],
  now: Date,
  weeks = PLAN_WEEKS
): Date[] {
  const monday = weekOf(
    now,
    rhythm.timeZone
  );
  const out: Date[] = [];

  for ( let w = 0; w < weeks; w++ ) {
    for ( const day of freeSlots(
      rhythm,
      posts,
      addDays(
        monday,
        w * 7
      ),
      now
    ).values() ) {
      out.push( ...day );
    }
  }

  return out.sort( (
    a, b
  ) => a.getTime() - b.getTime() );
}
