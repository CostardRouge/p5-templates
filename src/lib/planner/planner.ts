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

/** What a slot is for: a sketch made lately, or a favourite brought back. */
export type Pillar = "drop" | "favourite";

/** How the pillars alternate over the slots. */
export type Mix = "balanced" | "favourites" | "fresh";

export const MIXES: readonly { id: Mix;
  label: string;
  title: string }[] = [
  {
    id: "balanced",
    label: "Balanced",
    title: "One new sketch, one favourite, in turn"
  },
  {
    id: "favourites",
    label: "Favourites first",
    title: "Two favourites for one new sketch"
  },
  {
    id: "fresh",
    label: "New work first",
    title: "Two new sketches for one favourite"
  }
];

const PATTERN: Record<Mix, Pillar[]> = {
  balanced: [
    "drop",
    "favourite"
  ],
  favourites: [
    "favourite",
    "favourite",
    "drop"
  ],
  fresh: [
    "drop",
    "drop",
    "favourite"
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
  description?: string;
}

/** A sketch pinned to a slot by the person or an agent, with why. */
export interface Pin {
  /** `<engine>/<name>`, the key the publish store and the gallery use. */
  sketchKey: string;
  note?: string;
  by: "agent" | "person";
}

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
}

export const EMPTY_CHOICES: PlanChoices = {
  mix: DEFAULT_MIX,
  gapWeeks: DEFAULT_GAP_WEEKS,
  passed: {},
  skipped: {},
  pins: {}
};

export interface Proposal {
  /** `<pillar>:<engine>/<name>` — what «Another» passes over. */
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
  const pools: Record<Pillar, PlanSketch[]> = {
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

  for ( const at of slots ) {
    const pin = choices.pins[ at.toISOString() ];
    const sketch = pin ? byKey.get( pin.sketchKey ) : undefined;

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

    const wanted = pattern[ turn++ % pattern.length ];
    const order: Pillar[] = wanted === "drop" ? [
      "drop",
      "favourite"
    ] : [
      "favourite",
      "drop"
    ];
    let proposal: Proposal | null = null;

    for ( const pillar of order ) {
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
