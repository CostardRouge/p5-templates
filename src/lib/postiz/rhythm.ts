/**
 * The person's publishing RHYTHM — ported unchanged from Atelier
 * (`src/shared/sources/postiz/rhythm.ts`, its lab 12): the week's slots
 * (Tuesday 9:00, Friday 19:00, Sunday 10:00 in Paris by default), a ceiling
 * of posts a week, never two the same day. Export proposes the next free slot
 * and SAYS when a choice breaks the rhythm; it never forbids it. Posts made
 * from Atelier on the same Postiz take their slots here too.
 *
 * Times are wall-clock in the rhythm's own time zone, turned into instants
 * through `Intl` — no library; a slot keeps its 9:00 across a change of
 * daylight saving.
 *
 * Pure and DOM-free.
 */

export interface RhythmSlot {
  /** 0 = Sunday … 6 = Saturday. */
  day: number;
  /** `HH:MM`, in the rhythm's time zone. */
  time: string;
}

export interface Rhythm {
  timeZone: string;
  slots: RhythmSlot[];
  /** The most posts a week (Monday to Sunday). */
  perWeek: number;
}

export const DEFAULT_RHYTHM: Rhythm = {
  timeZone: "Europe/Paris",
  slots: [
    {
      day: 2,
      time: "09:00"
    },
    {
      day: 5,
      time: "19:00"
    },
    {
      day: 0,
      time: "10:00"
    }
  ],
  perWeek: 3
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validZone( tz: unknown ): tz is string {
  if ( typeof tz !== "string" || !tz ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: tz
      }
    );
    return true;
  } catch {
    return false;
  }
}

export function readRhythm( raw: unknown ): Rhythm {
  const r = ( raw && typeof raw === "object" ? raw : {} ) as Record<string, unknown>;
  const slots = Array.isArray( r.slots )
    ? r.slots.flatMap( ( s ) => {
      const o = ( s && typeof s === "object" ? s : {} ) as Record<string, unknown>;

      return Number.isInteger( o.day ) && ( o.day as number ) >= 0 && ( o.day as number ) <= 6 && typeof o.time === "string" && TIME_RE.test( o.time ) ? [
        {
          day: o.day as number,
          time: o.time
        }
      ] : [];
    } )
    : null;
  const perWeek = typeof r.perWeek === "number" && Number.isInteger( r.perWeek ) && r.perWeek >= 1 && r.perWeek <= 21 ? r.perWeek : DEFAULT_RHYTHM.perWeek;

  return {
    timeZone: validZone( r.timeZone ) ? r.timeZone : DEFAULT_RHYTHM.timeZone,
    slots: slots && slots.length ? slots.slice(
      0,
      14
    ) : DEFAULT_RHYTHM.slots.map( ( s ) => ( {
      ...s
    } ) ),
    perWeek
  };
}

/** The wall clock of `at` in `tz`: year, month (1–12), day, hour, minute, weekday (0 = Sunday). */
export function wallClock(
  at: Date, tz: string
): { y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  wd: number } {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23"
    }
  ).formatToParts( at );
  const get = ( t: string ) => parts.find( ( p ) => p.type === t )?.value ?? "";
  const wd = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ].indexOf( get( "weekday" ) );

  return {
    y: Number( get( "year" ) ),
    mo: Number( get( "month" ) ),
    d: Number( get( "day" ) ),
    h: Number( get( "hour" ) ) % 24,
    mi: Number( get( "minute" ) ),
    wd
  };
}

/** The instant whose wall clock in `tz` reads `y-mo-d h:mi`. */
export function zonedInstant(
  y: number, mo: number, d: number, h: number, mi: number, tz: string
): Date {
  const want = Date.UTC(
    y,
    mo - 1,
    d,
    h,
    mi
  );
  let guess = want;

  // Two passes settle the zone's offset, even across a change of daylight saving.
  for ( let i = 0; i < 3; i++ ) {
    const w = wallClock(
      new Date( guess ),
      tz
    );
    const seen = Date.UTC(
      w.y,
      w.mo - 1,
      w.d,
      w.h,
      w.mi
    );

    if ( seen === want ) {
      break;
    }
    guess += want - seen;
  }
  return new Date( guess );
}

/** The local day of `at` in `tz`, `YYYY-MM-DD`. */
export function localDay(
  at: Date, tz: string
): string {
  const w = wallClock(
    at,
    tz
  );

  return `${ w.y }-${ String( w.mo ).padStart(
    2,
    "0"
  ) }-${ String( w.d ).padStart(
    2,
    "0"
  ) }`;
}

/** The Monday that starts `at`'s week in `tz`, `YYYY-MM-DD`. */
export function weekOf(
  at: Date, tz: string
): string {
  const w = wallClock(
    at,
    tz
  );
  const back = ( w.wd + 6 ) % 7;
  const monday = new Date( Date.UTC(
    w.y,
    w.mo - 1,
    w.d - back
  ) );

  return monday.toISOString().slice(
    0,
    10
  );
}

/** The rhythm's slots from `from` on, in time order, `n` of them. */
export function upcomingSlots(
  rhythm: Rhythm, from: Date, n = 8
): Date[] {
  const out: Date[] = [];
  const start = wallClock(
    from,
    rhythm.timeZone
  );

  for ( let k = 0; k < 7 * 9 && out.length < n * 3; k++ ) {
    const day = new Date( Date.UTC(
      start.y,
      start.mo - 1,
      start.d + k
    ) );
    const wd = day.getUTCDay();

    for ( const s of rhythm.slots ) {
      if ( s.day !== wd ) {
        continue;
      }
      const [
        h,
        mi
      ] = s.time.split( ":" ).map( Number );
      const at = zonedInstant(
        day.getUTCFullYear(),
        day.getUTCMonth() + 1,
        day.getUTCDate(),
        h,
        mi,
        rhythm.timeZone
      );

      if ( at.getTime() > from.getTime() ) {
        out.push( at );
      }
    }
  }
  return out.sort( (
    a, b
  ) => a.getTime() - b.getTime() ).slice(
    0,
    n
  );
}

/** A slot is TAKEN when a post already goes out within this many minutes of it. */
const TAKEN_MIN = 90;

/** The slots of the rhythm from `from` on, each marked taken when a planned post already sits on it. */
export function slotsWithState(
  rhythm: Rhythm, planned: readonly Date[], from: Date, n = 6
): { at: Date;
  taken: boolean }[] {
  return upcomingSlots(
    rhythm,
    from,
    n + planned.length
  ).map( ( at ) => ( {
    at,
    taken: planned.some( ( p ) => Math.abs( p.getTime() - at.getTime() ) <= TAKEN_MIN * 60_000 )
  } ) )
    .slice(
      0,
      n
    );
}

/** The first slot no planned post holds, nor its day. */
export function nextFreeSlot(
  rhythm: Rhythm, planned: readonly Date[], from: Date
): Date | null {
  for ( const s of slotsWithState(
    rhythm,
    planned,
    from,
    24
  ) ) {
    if ( s.taken ) {
      continue;
    }
    if ( planned.some( ( p ) => localDay(
      p,
      rhythm.timeZone
    ) === localDay(
      s.at,
      rhythm.timeZone
    ) ) ) {
      continue;
    }
    if ( planned.filter( ( p ) => weekOf(
      p,
      rhythm.timeZone
    ) === weekOf(
      s.at,
      rhythm.timeZone
    ) ).length >= rhythm.perWeek ) {
      continue;
    }
    return s.at;
  }
  return null;
}

/** One cell of the rhythm's grid: a slot of one week, gone, taken by a planned post, or free. */
export interface RhythmCell {
  at: Date;
  state: "past" | "taken" | "free";
}

/** The rhythm's grid (lab 13): its slots as COLUMNS, Monday first, and the weeks from this one as ROWS. */
export interface RhythmGrid {
  slots: RhythmSlot[];
  weeks: { monday: string;
    label: string;
    cells: RhythmCell[] }[];
}

/** `10–16 Nov`, `24 Nov – 1 Dec`: a week from its Monday (`YYYY-MM-DD`). */
function weekLabel( monday: string ): string {
  const [
    y,
    m,
    d
  ] = monday.split( "-" ).map( Number );
  const end = new Date( Date.UTC(
    y,
    m - 1,
    d + 6
  ) );
  const em = end.getUTCMonth();

  return em === m - 1 ? `${ d }–${ end.getUTCDate() } ${ MONTHS[ em ] }` : `${ d } ${ MONTHS[ m - 1 ] } – ${ end.getUTCDate() } ${ MONTHS[ em ] }`;
}

/**
 * The next `weeks` weeks of the rhythm, in its zone, from the week holding
 * `now`: each slot's instant and whether it is gone, taken (a planned post
 * within 90 min of it, the rule `slotsWithState` keeps) or free. A slot is the
 * same column every week, so «Tue 9:00» reads as one thing that repeats.
 */
export function rhythmGrid(
  rhythm: Rhythm, planned: readonly Date[], now: Date, weeks = 3
): RhythmGrid {
  const slots = [
    ...rhythm.slots
  ].sort( (
    a, b
  ) => ( a.day + 6 ) % 7 - ( b.day + 6 ) % 7 || a.time.localeCompare( b.time ) );
  const first = weekOf(
    now,
    rhythm.timeZone
  );
  const [
    y,
    m,
    d
  ] = first.split( "-" ).map( Number );
  const out: RhythmGrid[ "weeks" ] = [];

  for ( let w = 0; w < weeks; w++ ) {
    const mon = new Date( Date.UTC(
      y,
      m - 1,
      d + 7 * w
    ) );
    const monday = mon.toISOString().slice(
      0,
      10
    );
    const cells = slots.map( ( s ): RhythmCell => {
      const day = new Date( Date.UTC(
        mon.getUTCFullYear(),
        mon.getUTCMonth(),
        mon.getUTCDate() + ( ( s.day + 6 ) % 7 )
      ) );
      const [
        h,
        mi
      ] = s.time.split( ":" ).map( Number );
      const at = zonedInstant(
        day.getUTCFullYear(),
        day.getUTCMonth() + 1,
        day.getUTCDate(),
        h,
        mi,
        rhythm.timeZone
      );
      const state = at.getTime() <= now.getTime() ? "past" : planned.some( ( p ) => Math.abs( p.getTime() - at.getTime() ) <= TAKEN_MIN * 60_000 ) ? "taken" : "free";

      return {
        at,
        state
      };
    } );

    out.push( {
      monday,
      label: weekLabel( monday ),
      cells
    } );
  }
  return {
    slots,
    weeks: out
  };
}

/** `Tue 9:00` — a slot as the grid's column says it. */
export function slotHead( s: RhythmSlot ): string {
  const [
    h,
    mi
  ] = s.time.split( ":" ).map( Number );

  return `${ DAYS[ s.day ] } ${ h }:${ String( mi ).padStart(
    2,
    "0"
  ) }`;
}

/** What a post at `at` would break, said plainly — or nothing. Never a refusal. */
export function rhythmWarnings(
  rhythm: Rhythm, planned: readonly Date[], at: Date
): string[] {
  const out: string[] = [];
  const day = localDay(
    at,
    rhythm.timeZone
  );

  if ( planned.some( ( p ) => localDay(
    p,
    rhythm.timeZone
  ) === day ) ) {
    out.push( "Another post already goes out that day." );
  }
  const inWeek = planned.filter( ( p ) => weekOf(
    p,
    rhythm.timeZone
  ) === weekOf(
    at,
    rhythm.timeZone
  ) ).length + 1;

  if ( inWeek > rhythm.perWeek ) {
    out.push( `That makes ${ inWeek } this week — your rhythm says ${ rhythm.perWeek }.` );
  }
  return out;
}

const DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat"
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

/** `Tue 17 Nov · 9:00`, in the rhythm's zone. */
export function slotLabel(
  at: Date, tz: string
): string {
  const w = wallClock(
    at,
    tz
  );

  return `${ DAYS[ w.wd ] } ${ w.d } ${ MONTHS[ w.mo - 1 ] } · ${ w.h }:${ String( w.mi ).padStart(
    2,
    "0"
  ) }`;
}

/** `Tuesday 9:00` — a slot of the rhythm, as the settings list it. */
export function rhythmSlotLabel( s: RhythmSlot ): string {
  const [
    h,
    mi
  ] = s.time.split( ":" ).map( Number );

  return `${ [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ][ s.day ] } ${ h }:${ String( mi ).padStart(
    2,
    "0"
  ) }`;
}
