/**
 * The READINGS this browser keeps of each post (lab 8, level 2): Postiz only
 * ever answers a post's totals as they are TODAY, so comparing a post of
 * yesterday with one of last month would compare ages, not posts. Three
 * readings are kept per post instead:
 *
 * - `early` — the first one taken between 2 and 7 days after it went out;
 * - `settled` — the first one taken 7 days or more after: the ONE two posts
 *   are compared by, and it is never rewritten;
 * - `last` — the latest, whatever its age, for the eye.
 *
 * `localStorage` (`sketchbook.stats.v1`), like the plan's choices: a few
 * hundred bytes a post, read synchronously by the planner's signal, and the
 * `storage` event tells the gallery's tab what the studio's tab read. Another
 * device has none of it — said where the figures are shown.
 *
 * The reducers are pure; nothing here asks Postiz anything (`reader.ts`).
 */

import type {
  PostAnalytics
} from "../postiz/analytics";
import {
  kept
} from "./kept";
import {
  figuresOf, type Figure, type MetricKey
} from "./metrics";

export const DAY_MS = 86_400_000;
/** From this age a reading is the «early» one. */
export const EARLY_DAYS = 2;
/** From this age a reading is the «settled» one. */
export const SETTLED_DAYS = 7;
/** The most posts kept; beyond it the oldest go. Three posts a week on four accounts is 600 a year. */
export const STATS_CAP = 1500;
export const STATS_KEY = "sketchbook.stats.v1";

export interface Reading {
  /** When Postiz was asked, epoch ms. */
  at: number;
  /** The post's age then, in days, one decimal. */
  ageDays: number;
  figures: Figure[];
}

export interface PostRecord {
  /** When the post went out, epoch ms. */
  publishedAt: number;
  /** The last time Postiz was asked about it, with or without figures. */
  askedAt: number;
  early?: Reading;
  settled?: Reading;
  last?: Reading;
  /** What Postiz had the last time it had no figure: an empty answer, or its «missing» state. */
  empty?: "none" | "missing";
}

export interface StatsState {
  /** By Postiz post id. */
  posts: Record<string, PostRecord>;
  /** A Postiz whose public API has no analytics route (an older version): its base, and when that was found. */
  unsupported: { base: string;
    at: number } | null;
}

export const EMPTY_STATS: StatsState = {
  posts: {},
  unsupported: null
};

const KEYS: ReadonlySet<string> = new Set<MetricKey>( [
  "reach",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "quotes",
  "favorites"
] );

function readReading( raw: unknown ): Reading | undefined {
  const r = ( raw && typeof raw === "object" ? raw : {} ) as Record<string, unknown>;

  if ( typeof r.at !== "number" || typeof r.ageDays !== "number" || !Array.isArray( r.figures ) ) {
    return undefined;
  }

  const figures = r.figures.flatMap( ( f ) => {
    const x = ( f && typeof f === "object" ? f : {} ) as Record<string, unknown>;

    return typeof x.label === "string" && typeof x.value === "number" && Number.isFinite( x.value ) ? [
      {
        label: x.label.slice(
          0,
          40
        ),
        key: typeof x.key === "string" && KEYS.has( x.key ) ? x.key as MetricKey : null,
        value: x.value
      }
    ] : [];
  } );

  return figures.length ? {
    at: r.at,
    ageDays: r.ageDays,
    figures
  } : undefined;
}

/** The readings as stored, whatever an older or a hand-edited copy holds. */
export function readStats( raw: unknown ): StatsState {
  const r = ( raw && typeof raw === "object" ? raw : {} ) as Record<string, unknown>;
  const posts: Record<string, PostRecord> = {};

  for ( const [
    id,
    value
  ] of Object.entries( r.posts && typeof r.posts === "object" ? r.posts as Record<string, unknown> : {} ) ) {
    const p = ( value && typeof value === "object" ? value : {} ) as Record<string, unknown>;

    if ( typeof p.publishedAt !== "number" || typeof p.askedAt !== "number" ) {
      continue;
    }

    const early = readReading( p.early );
    const settled = readReading( p.settled );
    const last = readReading( p.last );

    posts[ id ] = {
      publishedAt: p.publishedAt,
      askedAt: p.askedAt,
      ...( early ? {
        early
      } : {} ),
      ...( settled ? {
        settled
      } : {} ),
      ...( last ? {
        last
      } : {} ),
      ...( p.empty === "none" || p.empty === "missing" ? {
        empty: p.empty
      } : {} )
    };
  }

  const u = ( r.unsupported && typeof r.unsupported === "object" ? r.unsupported : {} ) as Record<string, unknown>;

  return {
    posts,
    unsupported: typeof u.base === "string" && typeof u.at === "number" ? {
      base: u.base,
      at: u.at
    } : null
  };
}

/** A post's age at `now`, in days. */
export function ageDays(
  publishedAt: number, now: number
): number {
  return ( now - publishedAt ) / DAY_MS;
}

/**
 * `record` after Postiz answered `answer` at `now`: figures become the last
 * reading, and the early or the settled one when the post's age makes it so
 * and none is kept yet; no figure is only remembered as asked.
 */
export function withAnswer(
  record: PostRecord | undefined, publishedAt: number, answer: PostAnalytics, now: number
): PostRecord {
  const base: PostRecord = {
    ...( record ?? {} ),
    publishedAt,
    askedAt: now
  };

  if ( answer.kind !== "figures" ) {
    return {
      ...base,
      empty: answer.kind
    };
  }

  const age = ageDays(
    publishedAt,
    now
  );
  const reading: Reading = {
    at: now,
    ageDays: Math.max(
      0,
      Math.round( age * 10 ) / 10
    ),
    figures: figuresOf( answer.series )
  };
  const next: PostRecord = {
    ...base,
    last: reading
  };

  delete next.empty;

  if ( age >= SETTLED_DAYS ) {
    next.settled ??= reading;
  } else if ( age >= EARLY_DAYS ) {
    next.early ??= reading;
  }

  return next;
}

/** `state` holding at most `cap` posts: the ones that went out longest ago are dropped first. */
export function pruned(
  state: StatsState, cap = STATS_CAP
): StatsState {
  const ids = Object.keys( state.posts );

  if ( ids.length <= cap ) {
    return state;
  }

  const keep = ids.sort( (
    a, b
  ) => state.posts[ b ].publishedAt - state.posts[ a ].publishedAt || a.localeCompare( b ) ).slice(
    0,
    cap
  );

  return {
    ...state,
    posts: Object.fromEntries( keep.map( ( id ) => [
      id,
      state.posts[ id ]
    ] ) )
  };
}

const store = kept(
  STATS_KEY,
  readStats
);

export const getStats = store.get;
export const subscribeStats = store.subscribe;
/** Forget every reading (Publishing › Results › Forget, and the tests). */
export const clearStats = store.clear;

/** Keep what Postiz answered about `postId`. */
export function keepAnswer(
  postId: string, publishedAt: number, answer: PostAnalytics, now: number
): StatsState {
  return store.update( ( state ) => pruned( {
    ...state,
    posts: {
      ...state.posts,
      [ postId ]: withAnswer(
        state.posts[ postId ],
        publishedAt,
        answer,
        now
      )
    }
  } ) );
}

/** Remember that the Postiz at `base` has no analytics route — or, with null, that it has one after all. */
export function markUnsupported(
  base: string | null, now: number
): StatsState {
  // Nothing to forget: no write, no reader woken.
  if ( !base && !store.get().unsupported ) {
    return store.get();
  }

  return store.update( ( state ) => ( {
    ...state,
    unsupported: base ? {
      base,
      at: now
    } : null
  } ) );
}
