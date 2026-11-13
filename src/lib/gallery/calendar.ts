/**
 * The gallery's calendars (lab 3): the MONTH (six fixed weeks, so the grid
 * never changes height from one month to the next) and the WEEK strip (seven
 * days, the rhythm's free slots — Atelier's Planned, `recap-planned.ts`'s
 * `weekStrip`, ported). Days are `YYYY-MM-DD` strings in one time zone, the
 * arithmetic done on UTC noons so no daylight-saving change moves a day.
 *
 * Pure and DOM-free.
 */

import {
  localDay, slotsWithState, weekOf, zonedInstant, type Rhythm
} from "@/lib/postiz/rhythm";
import {
  plannedInstants
} from "@/lib/postiz/plan";

export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  day: string;
  /** The day of the month. */
  n: number;
  /** `Mon` … `Sun`. */
  weekday: string;
  /** Belongs to the month shown (false for the leading and trailing days). */
  inMonth: boolean;
  today: boolean;
  past: boolean;
}

export interface Month {
  y: number;
  /** 1 – 12. */
  mo: number;
}

const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const noon = ( day: string ) => new Date( `${ day }T12:00:00Z` );
const iso = ( d: Date ) => d.toISOString().slice(
  0,
  10
);

/** `day` moved by `n` days. */
export function addDays(
  day: string, n: number
): string {
  const d = noon( day );

  d.setUTCDate( d.getUTCDate() + n );

  return iso( d );
}

function dayOf(
  d: Date, month: Month | null, today: string
): CalendarDay {
  const day = iso( d );

  return {
    day,
    n: d.getUTCDate(),
    weekday: WEEKDAYS[ d.getUTCDay() ],
    inMonth: month ? d.getUTCMonth() + 1 === month.mo && d.getUTCFullYear() === month.y : true,
    today: day === today,
    past: day < today
  };
}

/** The month a day falls in. */
export function monthOf( day: string ): Month {
  return {
    y: Number( day.slice(
      0,
      4
    ) ),
    mo: Number( day.slice(
      5,
      7
    ) )
  };
}

/** A month moved by `delta` months. */
export function shiftMonth(
  month: Month, delta: number
): Month {
  const k = month.y * 12 + ( month.mo - 1 ) + delta;

  return {
    y: Math.floor( k / 12 ),
    mo: ( ( k % 12 ) + 12 ) % 12 + 1
  };
}

/** `November 2026`. */
export function monthLabel( month: Month ): string {
  return `${ MONTH_NAMES[ month.mo - 1 ] } ${ month.y }`;
}

/** How many whole months `b` is after `a`. */
export function monthsBetween(
  a: Month, b: Month
): number {
  return ( b.y - a.y ) * 12 + ( b.mo - a.mo );
}

/**
 * The month as SIX weeks starting on Monday — always 42 days, whatever the
 * month, so the calendar keeps one height and nothing under it moves when
 * the person pages through the months.
 */
export function monthGrid(
  month: Month, today: string
): CalendarDay[] {
  const first = new Date( Date.UTC(
    month.y,
    month.mo - 1,
    1,
    12
  ) );
  const lead = ( first.getUTCDay() + 6 ) % 7;

  return Array.from(
    {
      length: 42
    },
    (
      _, k
    ) => dayOf(
      new Date( first.getTime() + ( k - lead ) * 86_400_000 ),
      month,
      today
    )
  );
}

/** The Monday of `day`'s week, moved by `offset` weeks. */
export function mondayOf(
  day: string, offset = 0
): string {
  const d = noon( day );
  const back = ( d.getUTCDay() + 6 ) % 7;

  return addDays(
    day,
    -back + offset * 7
  );
}

/** The seven days of the week starting `monday`. */
export function weekDays(
  monday: string, today: string
): CalendarDay[] {
  return Array.from(
    {
      length: 7
    },
    (
      _, k
    ) => dayOf(
      noon( addDays(
        monday,
        k
      ) ),
      null,
      today
    )
  );
}

const SHORT_MONTHS = MONTH_NAMES.map( ( m ) => m.slice(
  0,
  3
) );

/** `9–15 Nov`, `30 Nov – 6 Dec`. */
export function weekLabel( monday: string ): string {
  const a = noon( monday );
  const b = noon( addDays(
    monday,
    6
  ) );

  return a.getUTCMonth() === b.getUTCMonth()
    ? `${ a.getUTCDate() }–${ b.getUTCDate() } ${ SHORT_MONTHS[ b.getUTCMonth() ] }`
    : `${ a.getUTCDate() } ${ SHORT_MONTHS[ a.getUTCMonth() ] } – ${ b.getUTCDate() } ${ SHORT_MONTHS[ b.getUTCMonth() ] }`;
}

/**
 * The rhythm's slots still FREE in the week starting `monday`, by day — in
 * the future, no post within the slot's window, and no live post that day
 * (Atelier's `weekStrip`). EVERY post of the account counts, another app's
 * too: pass Postiz's whole list, never the gallery's filtered one.
 */
export function freeSlots(
  rhythm: Rhythm,
  posts: readonly { publishDate: string;
    state: string }[],
  monday: string,
  now: Date
): Map<string, Date[]> {
  const tz = rhythm.timeZone;
  const live = plannedInstants( posts );
  const start = zonedInstant(
    Number( monday.slice(
      0,
      4
    ) ),
    Number( monday.slice(
      5,
      7
    ) ),
    Number( monday.slice(
      8,
      10
    ) ),
    0,
    0,
    tz
  );
  const slots = slotsWithState(
    rhythm,
    live,
    new Date( Math.max(
      now.getTime(),
      start.getTime() - 1
    ) ),
    30
  ).filter( ( s ) => !s.taken && weekOf(
    s.at,
    tz
  ) === monday );
  const busy = new Set( live.map( ( at ) => localDay(
    at,
    tz
  ) ) );
  const out = new Map<string, Date[]>();

  for ( const s of slots ) {
    const day = localDay(
      s.at,
      tz
    );

    if ( !busy.has( day ) ) {
      out.set(
        day,
        [
          ...( out.get( day ) ?? [] ),
          s.at
        ]
      );
    }
  }

  return out;
}

/** How far the gallery reads Postiz, once when it opens (lab 3 Q6, Atelier's window): 5 weeks back, 8 ahead. */
export const BACK_WEEKS = 5;
export const AHEAD_WEEKS = 8;

/** The span asked of `GET /posts`: a week of margin each side, so the edge weeks are whole in any zone. */
export function postizWindow( now: number ): { from: Date;
  to: Date } {
  const week = 7 * 86_400_000;

  return {
    from: new Date( now - ( BACK_WEEKS + 1 ) * week ),
    to: new Date( now + ( AHEAD_WEEKS + 1 ) * week )
  };
}
