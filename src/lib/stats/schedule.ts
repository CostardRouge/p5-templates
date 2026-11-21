/**
 * WHEN a post is asked about — sparingly: every question Postiz cannot answer
 * from its own hour-long cache is a call to the network with the account's
 * token (X's counts against the instance's API quota). A post is read at most
 * three times by itself — once from its first day, once between 2 and 7 days,
 * once from 7 days — and then never again unless the person asks.
 *
 * Pure: the posts, what is kept and the clock in; who is due out.
 */

import type {
  Provider
} from "../postiz/client";
import {
  NO_POST_FIGURES
} from "./metrics";
import {
  ageDays, DAY_MS, EARLY_DAYS, SETTLED_DAYS, type PostRecord, type StatsState
} from "./store";

/** A post that may be asked about. */
export interface Candidate {
  postId: string;
  provider: Provider;
  /** When it went out, epoch ms. */
  publishedAt: number;
}

export type DueReason = "first" | "early" | "settled";

export interface Due extends Candidate {
  reason: DueReason;
}

/** A post is not asked about before this age: its first hours say nothing. */
export const FIRST_DAYS = 1;
/** A post asked about is left alone this long, figures or not — Postiz's own cache lasts an hour. */
export const RETRY_MS = 12 * 60 * 60 * 1000;
/** A post that never gave a figure is given up on at this age. */
export const GIVE_UP_DAYS = 45;
/** The most posts asked about in one run (a gallery opening, a `stats.read`). */
export const RUN_BUDGET = 12;
/** A Postiz found without the analytics route is asked again after this long (it may have been updated). */
export const UNSUPPORTED_MS = DAY_MS;

/** Why `post` is due at `now`, or null. */
export function dueReason(
  post: Candidate, record: PostRecord | undefined, now: number
): DueReason | null {
  if ( NO_POST_FIGURES.has( post.provider ) ) {
    return null;
  }

  const age = ageDays(
    post.publishedAt,
    now
  );

  if ( !Number.isFinite( age ) || age < FIRST_DAYS ) {
    return null;
  }

  if ( record && now - record.askedAt < RETRY_MS ) {
    return null;
  }

  // Nothing ever came: keep asking for a while, then let it be.
  if ( record && !record.last && age > GIVE_UP_DAYS ) {
    return null;
  }

  if ( age >= SETTLED_DAYS ) {
    return record?.settled ? null : "settled";
  }

  if ( age >= EARLY_DAYS ) {
    return record?.early ? null : "early";
  }

  return record?.last ? null : "first";
}

const RANK: Record<DueReason, number> = {
  settled: 0,
  early: 1,
  first: 2
};

/**
 * The posts to ask about now, `budget` at most: the settled readings first
 * (they are what comparisons wait for), the oldest post first, each post once.
 * None while the Postiz is known to have no analytics route.
 */
export function dueReadings(
  posts: readonly Candidate[], state: StatsState, now: number, apiBase: string, budget = RUN_BUDGET
): Due[] {
  if ( unsupportedNow(
    state,
    apiBase,
    now
  ) ) {
    return [];
  }

  const seen = new Set<string>();
  const due: Due[] = [];

  for ( const post of posts ) {
    if ( seen.has( post.postId ) ) {
      continue;
    }
    seen.add( post.postId );

    const reason = dueReason(
      post,
      state.posts[ post.postId ],
      now
    );

    if ( reason ) {
      due.push( {
        ...post,
        reason
      } );
    }
  }

  return due.sort( (
    a, b
  ) => RANK[ a.reason ] - RANK[ b.reason ] || a.publishedAt - b.publishedAt || a.postId.localeCompare( b.postId ) ).slice(
    0,
    Math.max(
      0,
      budget
    )
  );
}

/** True while the Postiz at `apiBase` is remembered as having no analytics route. */
export function unsupportedNow(
  state: StatsState, apiBase: string, now: number
): boolean {
  return Boolean( state.unsupported && state.unsupported.base === apiBase && now - state.unsupported.at < UNSUPPORTED_MS );
}

/** A post left alone for this long may be read again when the person LOOKS at it (its sketch's sheet) — only while it has not settled. */
export const LOOK_MS = 60 * 60 * 1000;

/** The posts worth asking about when their sketch's sheet opens: out for a day, not settled yet, not asked within the hour. */
export function dueOnLook(
  posts: readonly Candidate[], state: StatsState, now: number, apiBase: string, budget = RUN_BUDGET
): Candidate[] {
  if ( unsupportedNow(
    state,
    apiBase,
    now
  ) ) {
    return [];
  }

  return posts.filter( ( post ) => {
    const record = state.posts[ post.postId ];
    const age = ageDays(
      post.publishedAt,
      now
    );

    return !NO_POST_FIGURES.has( post.provider ) &&
      age >= FIRST_DAYS &&
      !record?.settled &&
      !( record && !record.last && age > GIVE_UP_DAYS ) &&
      ( !record || now - record.askedAt >= LOOK_MS );
  } ).slice(
    0,
    Math.max(
      0,
      budget
    )
  );
}
