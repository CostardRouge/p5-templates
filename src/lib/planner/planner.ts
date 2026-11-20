/**
 * The PLAN (lab 7, `docs/memory/publishing.md`): what to post on each free
 * slot of the rhythm over the coming weeks, drawn from the catalogue — the
 * sketches made lately and never posted, in the order of their series, and
 * the favourites (`favorite` in a sketch's `sketch.json`), never one posted
 * too recently. It is a calculation, not an agent: the same catalogue, the
 * same calendar and the same choices always give the same plan, so the
 * gallery's Plan view and the agent's `plan.get` read ONE thing.
 *
 * A proposal is only a proposal — Atelier's Suggestions rule: nothing is kept
 * until the person acts on it, «Another» passes a sketch over by its key and
 * «Skip» leaves a slot empty.
 *
 * Pure and DOM-free: the catalogue, the free slots, what was posted and the
 * person's choices all come in as data.
 */

import {
  sketchTitle
} from "../postiz/caption";
import {
  localDay
} from "../postiz/rhythm";

/**
 * What a slot is for: a sketch made lately, a favourite brought back, a whole
 * SERIES in one Reel, or a RECAP of a month or of the year. The last two are
 * not a sketch but a reel of several (`reel.ts`), opened on the empty host.
 */
export type Pillar = "drop" | "favourite" | "series" | "recap";

/** How the pillars alternate over the slots. */
export type Mix = "balanced" | "favourites" | "fresh";

export const MIXES: readonly { id: Mix;
  label: string;
  title: string }[] = [
  {
    id: "balanced",
    label: "Balanced",
    title: "One new sketch, one favourite, in turn, and a series every fifth post"
  },
  {
    id: "favourites",
    label: "Favourites first",
    title: "Three favourites for one new sketch, and a series every fifth post"
  },
  {
    id: "fresh",
    label: "New work first",
    title: "Three new sketches for one favourite, and a series every fifth post"
  }
];

const PATTERN: Record<Mix, Pillar[]> = {
  balanced: [
    "drop",
    "favourite",
    "drop",
    "favourite",
    "series"
  ],
  favourites: [
    "favourite",
    "favourite",
    "drop",
    "favourite",
    "series"
  ],
  fresh: [
    "drop",
    "drop",
    "favourite",
    "drop",
    "series"
  ]
};

export const GAP_WEEKS = [
  4,
  8,
  12
] as const;
export const DEFAULT_GAP_WEEKS = 8;
export const DEFAULT_MIX: Mix = "balanced";
/** How far ahead the plan looks — the gallery reads Postiz 8 weeks ahead, the plan stays inside it. */
export const PLAN_WEEKS = 5;
/** A sketch is «new» for this long after it was made. */
export const FRESH_DAYS = 120;

/** The sketch a reel of several sketches is built on: it draws nothing of its own. */
export const REEL_HOST: Pick<PlanSketch, "engine" | "name" | "category"> = {
  engine: "p5",
  name: "empty-sketch",
  category: null
};
/** A reel holds this many sketches at most; a longer series is sampled, first and last kept. */
export const REEL_MAX = 8;
/** Fewer than this is not a series, nor a month worth a recap. */
export const REEL_MIN = 3;
/** A month's recap is proposed on the first free slot of the next month, if that comes within this many days. */
const RECAP_WITHIN_DAYS = 14;
/**
 * Series that cannot play as a scene by themselves: they wait for a camera, a
 * microphone, a file or a hand. Nothing in the catalogue says so, hence names.
 */
const NEEDS_INPUT = /^(photo|video|audio|hand-capture|face-capture|interactive)/;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** What the plan needs of a catalogue entry (`src/sketches/metadata.json`). */
export interface PlanSketch {
  engine: string;
  name: string;
  category?: string | null;
  /** `YYYY-MM-DD`. */
  createdAt?: string;
  favorite?: boolean;
  hasPreview?: boolean;
  hiddenFromGallery?: boolean;
  /** Draws asynchronously: cannot run as a scene of a reel. */
  asyncDraw?: boolean;
  description?: string;
}

/** A sketch pinned to a slot by the person or an agent, with why. */
export interface Pin {
  /** `<engine>/<name>`, the key the publish store and the gallery use. */
  sketchKey: string;
  note?: string;
  by: "agent" | "person";
  /**
   * A reel made on purpose instead of one sketch — «every favourite of this
   * series», «what I posted in November»: its card's words and its sketches,
   * `<engine>/<name>` each, in order. `sketchKey` is then the host's.
   */
  reel?: { title: string;
    subtitle: string;
    sketches: string[];
    pillar: "series" | "recap"; };
}

/** A reel made on purpose holds this many sketches at most (a planned series is sampled to `REEL_MAX`). */
export const PIN_REEL_MAX = 12;

/** The person's choices, as `planStore` keeps them. */
export interface PlanChoices {
  mix: Mix;
  gapWeeks: number;
  /** Proposal keys passed over («Another»), with when. */
  passed: Record<string, number>;
  /** Slots left empty («Skip»), by ISO instant, with when. */
  skipped: Record<string, number>;
  /** Slots given a sketch on purpose, by ISO instant. */
  pins: Record<string, Pin>;
  /**
   * Series and recaps OPENED on Export › Publish, by proposal key, with when.
   * A reel is posted from the host sketch, so no post names its series: having
   * opened it is the only trace, and it keeps the reel away for the gap.
   */
  opened: Record<string, number>;
}

export const EMPTY_CHOICES: PlanChoices = {
  mix: DEFAULT_MIX,
  gapWeeks: DEFAULT_GAP_WEEKS,
  passed: {},
  skipped: {},
  pins: {},
  opened: {}
};

export interface Proposal {
  /** `<pillar>:<engine>/<name>`, `series:<engine>/<category>`, `recap:2026-11`, `recap:2026` — what «Another» passes over. */
  key: string;
  pillar: Pillar;
  sketchKey: string;
  /** `engine/category/name`, the sketch's route tail and `studio.open`'s id. */
  path: string;
  title: string;
  /** Why this sketch, here: read by the person, never a metric. */
  why: string;
  favorite: boolean;
  /** Set when the slot was pinned rather than drawn. */
  pin?: Pin;
  /** A series or a recap: the sketches of its reel, in order, `<engine>/<name>` each. */
  reel?: Reel;
}

/** Several sketches cut together in one Reel on the empty host (`reel.ts`). */
export interface Reel {
  /** The opening card's words. */
  title: string;
  subtitle: string;
  /** `<engine>/<name>` of each scene, in order — also the thumbnails. */
  sketches: string[];
  /** The `sequence` item's own ids, `<category>/<name>` or `<name>`. */
  scenes: string[];
}

export interface PlanSlot {
  /** The slot's instant, ISO — its id. */
  slot: string;
  at: Date;
  proposal: Proposal | null;
  skipped: boolean;
}

export interface PlanInput {
  catalogue: readonly PlanSketch[];
  /** The rhythm's free slots, any order. */
  slots: readonly Date[];
  /** Every known send of a sketch, past or still ahead: `<engine>/<name>` and when (ms). */
  posted: readonly { sketchKey: string;
    at: number }[];
  choices: PlanChoices;
  now: number;
  /** The rhythm's zone: a month ends at ITS midnight. UTC when absent. */
  timeZone?: string;
}

export function sketchKeyOf( s: Pick<PlanSketch, "engine" | "name"> ): string {
  return `${ s.engine }/${ s.name }`;
}

export function sketchPath( s: Pick<PlanSketch, "engine" | "name" | "category"> ): string {
  return [
    s.engine,
    s.category,
    s.name
  ].filter( Boolean ).join( "/" );
}

/** `churros-v9-pasta` → 9, `36days-of-type-2023-4` → 4, else 0: the order inside a series. */
export function versionOf( name: string ): number {
  const v = /(?:^|-)v(\d+)(?:-|$)/.exec( name ) ?? /-(\d+)$/.exec( name );

  return v ? Number( v[ 1 ] ) : 0;
}

/** A small stable number from a string: spreads the favourites without a random draw. */
function hash( text: string ): number {
  let h = 2166136261;

  for ( let i = 0; i < text.length; i++ ) {
    h = Math.imul(
      h ^ text.charCodeAt( i ),
      16777619
    );
  }

  return h >>> 0;
}

function seriesOf( s: PlanSketch ): string {
  return s.category || s.name;
}

function ordinal( n: number ): string {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : [
    "th",
    "st",
    "nd",
    "rd"
  ][ n % 10 ] ?? "th";

  return `${ n }${ tail }`;
}

function shortDay( at: number ): string {
  return new Date( at ).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }
  );
}

/**
 * The new sketches still to post (a favourite has its own pillar), the newest series first, each series in its
 * own order (v1 before v2) and the series taken in turn so two of one series
 * never follow each other while another waits.
 */
export function dropPool(
  catalogue: readonly PlanSketch[], everPosted: ReadonlySet<string>, now: number
): PlanSketch[] {
  const since = new Date( now - FRESH_DAYS * DAY_MS ).toISOString()
    .slice(
      0,
      10
    );
  const fresh = catalogue.filter( ( s ) => !s.hiddenFromGallery && !s.favorite && ( s.createdAt ?? "" ) >= since && !everPosted.has( sketchKeyOf( s ) ) );
  const series = new Map<string, PlanSketch[]>();

  for ( const s of fresh ) {
    series.set(
      seriesOf( s ),
      [
        ...( series.get( seriesOf( s ) ) ?? [] ),
        s
      ]
    );
  }

  const queues = [
    ...series.entries()
  ].map( ( [
    id,
    list
  ] ) => ( {
    id,
    newest: list.reduce(
      (
        m, s
      ) => ( s.createdAt ?? "" ) > m ? s.createdAt ?? "" : m,
      ""
    ),
    list: [
      ...list
    ].sort( (
      a, b
    ) => versionOf( a.name ) - versionOf( b.name ) || ( a.createdAt ?? "" ).localeCompare( b.createdAt ?? "" ) || a.name.localeCompare( b.name ) )
  } ) )
    .sort( (
      a, b
    ) => b.newest.localeCompare( a.newest ) || a.id.localeCompare( b.id ) );
  const out: PlanSketch[] = [];

  while ( queues.some( ( q ) => q.list.length ) ) {
    for ( const q of queues ) {
      const next = q.list.shift();

      if ( next ) {
        out.push( next );
      }
    }
  }

  return out;
}

/** The favourites: never posted first, then the longest unseen; a preview before none; then a stable spread. */
export function favouritePool(
  catalogue: readonly PlanSketch[], lastPosted: ReadonlyMap<string, number>
): PlanSketch[] {
  return catalogue.filter( ( s ) => s.favorite && !s.hiddenFromGallery ).sort( (
    a, b
  ) => ( lastPosted.get( sketchKeyOf( a ) ) ?? 0 ) - ( lastPosted.get( sketchKeyOf( b ) ) ?? 0 ) ||
    Number( Boolean( b.hasPreview ) ) - Number( Boolean( a.hasPreview ) ) ||
    hash( a.name ) - hash( b.name ) ||
    a.name.localeCompare( b.name ) );
}

/** True when `sketchKey` has a send within `gapWeeks` of `at`, before or after. */
export function tooSoon(
  posted: readonly { sketchKey: string;
    at: number }[], sketchKey: string, at: number, gapWeeks: number
): boolean {
  return posted.some( ( p ) => p.sketchKey === sketchKey && Math.abs( p.at - at ) < gapWeeks * WEEK_MS );
}

/** A sketch that can be a scene of a reel: p5, shown, drawing by itself. */
export function playable( s: PlanSketch ): boolean {
  return s.engine === REEL_HOST.engine && !s.hiddenFromGallery && !s.asyncDraw && s.name !== REEL_HOST.name && !NEEDS_INPUT.test( seriesOf( s ) );
}

/** At most `REEL_MAX` of `list`, spread evenly, the first and the last kept. */
export function sampleReel<T>( list: readonly T[] ): T[] {
  if ( list.length <= REEL_MAX ) {
    return [
      ...list
    ];
  }

  return Array.from(
    {
      length: REEL_MAX
    },
    (
      _, i
    ) => list[ Math.round( i * ( list.length - 1 ) / ( REEL_MAX - 1 ) ) ]
  );
}

/** The reel of `sketches`, sampled to `REEL_MAX` unless `whole`. */
export function reelOf(
  title: string, subtitle: string, sketches: readonly PlanSketch[], whole = false
): Reel {
  const picked = whole ? [
    ...sketches
  ] : sampleReel( sketches );

  return {
    title,
    subtitle,
    sketches: picked.map( sketchKeyOf ),
    scenes: picked.map( ( s ) => s.category ? `${ s.category }/${ s.name }` : s.name )
  };
}

function reelProposal(
  key: string, pillar: "series" | "recap", title: string, why: string, reel: Reel
): Proposal {
  return {
    key,
    pillar,
    sketchKey: sketchKeyOf( REEL_HOST ),
    path: sketchPath( REEL_HOST ),
    title,
    why,
    favorite: false,
    reel
  };
}

const capital = ( text: string ) => text.charAt( 0 ).toUpperCase() + text.slice( 1 );

/**
 * The series worth a Reel of their own: a category of three playable sketches
 * or more, the one touched last first. A series opened within the gap waits.
 */
export function seriesPool( catalogue: readonly PlanSketch[] ): Proposal[] {
  const groups = new Map<string, PlanSketch[]>();

  for ( const s of catalogue ) {
    if ( s.category && playable( s ) ) {
      groups.set(
        s.category,
        [
          ...( groups.get( s.category ) ?? [] ),
          s
        ]
      );
    }
  }

  return [
    ...groups.entries()
  ].filter( ( [
    , list
  ] ) => list.length >= REEL_MIN )
    .map( ( [
      category,
      list
    ] ) => {
      const ordered = [
        ...list
      ].sort( (
        a, b
      ) => versionOf( a.name ) - versionOf( b.name ) || ( a.createdAt ?? "" ).localeCompare( b.createdAt ?? "" ) || a.name.localeCompare( b.name ) );
      const name = capital( category.replace(
        /-/g,
        " "
      ) );
      const reel = reelOf(
        name.toUpperCase(),
        `${ ordered.length } SKETCHES`,
        ordered
      );

      return {
        newest: ordered.reduce(
          (
            m, s
          ) => ( s.createdAt ?? "" ) > m ? s.createdAt ?? "" : m,
          ""
        ),
        proposal: reelProposal(
          `series:${ REEL_HOST.engine }/${ category }`,
          "series",
          `${ name } · the series`,
          `${ ordered.length } sketches in one Reel${ reel.sketches.length < ordered.length ? `, ${ reel.sketches.length } of them shown` : "" } · built on the empty sketch as a sequence`,
          reel
        )
      };
    } )
    .sort( (
      a, b
    ) => b.newest.localeCompare( a.newest ) || a.proposal.key.localeCompare( b.proposal.key ) )
    .map( ( entry ) => entry.proposal );
}

const MONTHS = [
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

/**
 * The recap of the month `month` (`YYYY-MM`): what was POSTED in it, in the
 * order it went out, when that makes three; else what was MADE in it; else
 * nothing — a recap never pads.
 */
export function monthRecap(
  catalogue: readonly PlanSketch[], posted: readonly { sketchKey: string;
    at: number }[], month: string, timeZone: string
): Proposal | null {
  const byKey = new Map( catalogue.map( ( s ) => [
    sketchKeyOf( s ),
    s
  ] ) );
  const sent = [
    ...posted
  ].sort( (
    a, b
  ) => a.at - b.at ).filter( ( p ) => localDay(
    new Date( p.at ),
    timeZone
  ).startsWith( month ) )
    .map( ( p ) => byKey.get( p.sketchKey ) )
    .filter( ( s ): s is PlanSketch => Boolean( s && playable( s ) ) );
  const posts = [
    ...new Set( sent )
  ];
  const made = catalogue.filter( ( s ) => playable( s ) && ( s.createdAt ?? "" ).startsWith( month ) )
    .sort( (
      a, b
    ) => ( a.createdAt ?? "" ).localeCompare( b.createdAt ?? "" ) || versionOf( a.name ) - versionOf( b.name ) || a.name.localeCompare( b.name ) );
  const from = posts.length >= REEL_MIN ? posts : made;

  if ( from.length < REEL_MIN ) {
    return null;
  }

  const name = MONTHS[ Number( month.slice( 5 ) ) - 1 ] ?? month;
  const reel = reelOf(
    name.toUpperCase(),
    `${ month.slice(
      0,
      4
    ) } IN SKETCHES`,
    from
  );

  return reelProposal(
    `recap:${ month }`,
    "recap",
    `${ name } in sketches`,
    `${ from.length } ${ from === posts ? "sketches posted" : "sketches made" } in ${ name }${ reel.sketches.length < from.length ? `, ${ reel.sketches.length } of them shown` : "" } · the month is over`,
    reel
  );
}

/** The year, month by month: for each month a favourite made in it, else the last sketch made in it. */
export function yearRecap(
  catalogue: readonly PlanSketch[], year: string
): Proposal | null {
  const picks: PlanSketch[] = [];

  for ( let m = 1; m <= 12; m++ ) {
    const month = `${ year }-${ String( m ).padStart(
      2,
      "0"
    ) }`;
    const made = catalogue.filter( ( s ) => playable( s ) && ( s.createdAt ?? "" ).startsWith( month ) )
      .sort( (
        a, b
      ) => Number( Boolean( b.favorite ) ) - Number( Boolean( a.favorite ) ) || ( b.createdAt ?? "" ).localeCompare( a.createdAt ?? "" ) || a.name.localeCompare( b.name ) );

    if ( made[ 0 ] ) {
      picks.push( made[ 0 ] );
    }
  }

  if ( picks.length < REEL_MIN ) {
    return null;
  }

  const picked = picks.length > REEL_MAX + 4 ? sampleReel( picks ) : picks;

  return reelProposal(
    `recap:${ year }`,
    "recap",
    `${ year }, month by month`,
    `One sketch for each of ${ picks.length } months of ${ year } — a favourite made that month, else the last one made`,
    {
      title: year,
      subtitle: "MONTH BY MONTH",
      sketches: picked.map( sketchKeyOf ),
      scenes: picked.map( ( s ) => s.category ? `${ s.category }/${ s.name }` : s.name )
    }
  );
}

/** `2026-12` → `2026-11`. */
function monthBefore( month: string ): string {
  const y = Number( month.slice(
    0,
    4
  ) );
  const m = Number( month.slice( 5 ) );

  return m === 1 ? `${ y - 1 }-12` : `${ y }-${ String( m - 1 ).padStart(
    2,
    "0"
  ) }`;
}

/**
 * The fixed rendezvous among `slots` (time order): the first slot of a month,
 * within two weeks of its start, recaps the month before; the last slot of
 * December, or failing that the first of January, recaps the year.
 */
export function rendezvous(
  slots: readonly Date[], catalogue: readonly PlanSketch[], posted: readonly { sketchKey: string;
    at: number }[], timeZone: string
): Map<string, Proposal> {
  const out = new Map<string, Proposal>();
  const days = slots.map( ( at ) => localDay(
    at,
    timeZone
  ) );
  const seen = new Set<string>();

  slots.forEach( (
    at, i
  ) => {
    const month = days[ i ].slice(
      0,
      7
    );

    if ( seen.has( month ) ) {
      return;
    }
    seen.add( month );

    // The first slot of a month in the plan — but only when the plan saw the month begin.
    if ( i > 0 && Number( days[ i ].slice( 8 ) ) <= RECAP_WITHIN_DAYS ) {
      const recap = monthRecap(
        catalogue,
        posted,
        monthBefore( month ),
        timeZone
      );

      if ( recap ) {
        out.set(
          at.toISOString(),
          recap
        );
      }
    }
  } );

  const december = slots.filter( (
    _, i
  ) => days[ i ].slice(
    5,
    7
  ) === "12" && Number( days[ i ].slice( 8 ) ) >= 15 ).pop();
  const january = slots.find( (
    _, i
  ) => days[ i ].slice(
    5,
    7
  ) === "01" && Number( days[ i ].slice( 8 ) ) <= 15 );
  const closing = december ?? january;

  if ( closing && !out.has( closing.toISOString() ) ) {
    const day = localDay(
      closing,
      timeZone
    );
    const year = december ? day.slice(
      0,
      4
    ) : String( Number( day.slice(
      0,
      4
    ) ) - 1 );
    const recap = yearRecap(
      catalogue,
      year
    );

    if ( recap ) {
      out.set(
        closing.toISOString(),
        recap
      );
    }
  }

  return out;
}

function whyOf(
  s: PlanSketch, pillar: Pillar, catalogue: readonly PlanSketch[], last: number | undefined
): string {
  const parts: string[] = [];

  if ( pillar === "drop" ) {
    const siblings = catalogue.filter( ( c ) => c.category && c.category === s.category && c.engine === s.engine )
      .sort( (
        a, b
      ) => versionOf( a.name ) - versionOf( b.name ) || a.name.localeCompare( b.name ) );
    const rank = siblings.findIndex( ( c ) => c.name === s.name ) + 1;

    parts.push( s.createdAt ? `Made ${ shortDay( Date.parse( s.createdAt ) ) }` : "New" );
    if ( siblings.length > 1 && rank > 0 ) {
      parts.push( `${ ordinal( rank ) } of ${ siblings.length } in its series` );
    }
  } else {
    parts.push( "A favourite" );
  }

  parts.push( last === undefined ? "never posted from here" : `last posted ${ shortDay( last ) }` );
  if ( !s.description ) {
    parts.push( "no description yet" );
  }

  return parts.join( " · " );
}

function proposalOf(
  s: PlanSketch, pillar: Pillar, catalogue: readonly PlanSketch[], last: number | undefined, pin?: Pin
): Proposal {
  return {
    key: `${ pillar }:${ sketchKeyOf( s ) }`,
    pillar,
    sketchKey: sketchKeyOf( s ),
    path: sketchPath( s ),
    title: sketchTitle(
      s.name,
      s.category
    ),
    why: pin?.note ? pin.note : whyOf(
      s,
      pillar,
      catalogue,
      last
    ),
    favorite: Boolean( s.favorite ),
    ...( pin ? {
      pin
    } : {} )
  };
}

/**
 * The plan: one line per free slot, in time order. A pinned slot keeps its
 * sketch; a skipped one stays empty; every other takes the next sketch of
 * its pillar that was not passed over, is not already in the plan, was not
 * posted within the gap and is not of the series just before it.
 */
export function planSlots( input: PlanInput ): PlanSlot[] {
  const {
    catalogue, choices, now
  } = input;
  const byKey = new Map( catalogue.map( ( s ) => [
    sketchKeyOf( s ),
    s
  ] ) );
  const lastPosted = new Map<string, number>();

  for ( const p of input.posted ) {
    if ( p.at <= now && p.at > ( lastPosted.get( p.sketchKey ) ?? 0 ) ) {
      lastPosted.set(
        p.sketchKey,
        p.at
      );
    }
  }

  const everPosted = new Set( input.posted.map( ( p ) => p.sketchKey ) );
  const pools: Record<"drop" | "favourite", PlanSketch[]> = {
    drop: dropPool(
      catalogue,
      everPosted,
      now
    ),
    favourite: favouritePool(
      catalogue,
      lastPosted
    )
  };
  const slots = [
    ...input.slots
  ].filter( ( at ) => at.getTime() > now ).sort( (
    a, b
  ) => a.getTime() - b.getTime() );
  const pinned = new Map<string, PlanSketch>();

  const pinnedReels = new Map<string, Proposal>();

  for ( const at of slots ) {
    const pin = choices.pins[ at.toISOString() ];
    const sketch = pin ? byKey.get( pin.sketchKey ) : undefined;

    if ( pin?.reel && !choices.skipped[ at.toISOString() ] ) {
      const scenes = pin.reel.sketches.map( ( key ) => byKey.get( key ) ).filter( ( s ): s is PlanSketch => Boolean( s && playable( s ) ) );

      if ( scenes.length >= 2 ) {
        pinnedReels.set(
          at.toISOString(),
          {
            ...reelProposal(
              `pin:${ at.toISOString() }`,
              pin.reel.pillar,
              pin.reel.title,
              pin.note ?? `${ scenes.length } sketches chosen for this slot`,
              reelOf(
                pin.reel.title.toUpperCase(),
                pin.reel.subtitle,
                scenes,
                true
              )
            ),
            pin
          }
        );
      }
      continue;
    }

    if ( sketch && !choices.skipped[ at.toISOString() ] ) {
      pinned.set(
        at.toISOString(),
        sketch
      );
    }
  }

  const used = new Set( [
    ...pinned.values()
  ].map( sketchKeyOf ) );
  const pattern = PATTERN[ choices.mix ] ?? PATTERN[ DEFAULT_MIX ];
  const gapMs = choices.gapWeeks * WEEK_MS;
  // A reel passed over, or opened within the gap, waits.
  const reelFree = ( p: Proposal ) => !choices.passed[ p.key ] && !( now - ( choices.opened?.[ p.key ] ?? -Infinity ) < gapMs );
  const dates = rendezvous(
    slots,
    catalogue,
    input.posted,
    input.timeZone ?? "UTC"
  );
  const series = seriesPool( catalogue ).filter( reelFree );
  const out: PlanSlot[] = [];
  let turn = 0;
  let previous: string | null = null;

  for ( const at of slots ) {
    const slot = at.toISOString();

    if ( choices.skipped[ slot ] ) {
      out.push( {
        slot,
        at,
        proposal: null,
        skipped: true
      } );
      continue;
    }

    const pinnedReel = pinnedReels.get( slot );

    if ( pinnedReel ) {
      out.push( {
        slot,
        at,
        proposal: pinnedReel,
        skipped: false
      } );
      previous = null;
      continue;
    }

    const pin = pinned.get( slot );

    if ( pin ) {
      out.push( {
        slot,
        at,
        proposal: proposalOf(
          pin,
          pin.favorite ? "favourite" : "drop",
          catalogue,
          lastPosted.get( sketchKeyOf( pin ) ),
          choices.pins[ slot ]
        ),
        skipped: false
      } );
      previous = seriesOf( pin );
      continue;
    }

    const date = dates.get( slot );

    if ( date && reelFree( date ) ) {
      out.push( {
        slot,
        at,
        proposal: date,
        skipped: false
      } );
      previous = null;
      continue;
    }

    const wanted = pattern[ turn++ % pattern.length ];
    const order: ( "drop" | "favourite" )[] = wanted === "favourite" ? [
      "favourite",
      "drop"
    ] : [
      "drop",
      "favourite"
    ];
    let proposal: Proposal | null = wanted === "series" ? series.shift() ?? null : null;

    if ( proposal ) {
      previous = null;
    }

    for ( const pillar of proposal ? [] : order ) {
      const free = ( s: PlanSketch ) => !used.has( sketchKeyOf( s ) ) &&
        !choices.passed[ `${ pillar }:${ sketchKeyOf( s ) }` ] &&
        !tooSoon(
          input.posted,
          sketchKeyOf( s ),
          at.getTime(),
          choices.gapWeeks
        );
      const pick = pools[ pillar ].find( ( s ) => free( s ) && seriesOf( s ) !== previous ) ?? pools[ pillar ].find( free );

      if ( pick ) {
        used.add( sketchKeyOf( pick ) );
        previous = seriesOf( pick );
        proposal = proposalOf(
          pick,
          pillar,
          catalogue,
          lastPosted.get( sketchKeyOf( pick ) )
        );
        break;
      }
    }

    out.push( {
      slot,
      at,
      proposal,
      skipped: false
    } );
  }

  return out;
}
