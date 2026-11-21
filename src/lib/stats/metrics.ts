/**
 * A post's figures, as its network gives them through Postiz — the labels
 * kept VERBATIM for the eye (`Reach`, `Impressions`, `Reposts`) and filed
 * under a common key only so that two posts of ONE account can be compared.
 * Nothing is derived that a network did not give: an absent figure stays
 * absent, never zero.
 *
 * What each network gives is written down in `src/lib/postiz/analytics.ts`.
 *
 * Pure and DOM-free.
 */

import type {
  AnalyticsSeries
} from "../postiz/analytics";
import type {
  Provider
} from "../postiz/client";

/** The common keys. `views` also files X's Impressions; `comments` Threads' and X's Replies; `shares` Reposts and Retweets; `saves` X's Bookmarks. */
export type MetricKey = "reach" | "views" | "likes" | "comments" | "shares" | "saves" | "quotes" | "favorites";

const KEY_OF: Record<string, MetricKey> = {
  reach: "reach",
  views: "views",
  impressions: "views",
  likes: "likes",
  comments: "comments",
  replies: "comments",
  shares: "shares",
  reposts: "shares",
  retweets: "shares",
  saves: "saves",
  bookmarks: "saves",
  quotes: "quotes",
  favorites: "favorites"
};

/** One figure of a post: Postiz's label, its common key when it has one, the total. */
export interface Figure {
  label: string;
  key: MetricKey | null;
  value: number;
}

/** A post's figures from Postiz's answer: each label's LAST point (a post has one), in Postiz's order. */
export function figuresOf( series: readonly AnalyticsSeries[] ): Figure[] {
  return series.flatMap( ( s ) => {
    const last = s.points[ s.points.length - 1 ];

    return last ? [
      {
        label: s.label,
        key: KEY_OF[ s.label.trim().toLowerCase() ] ?? null,
        value: last.total
      }
    ] : [];
  } );
}

export function figure(
  figures: readonly Figure[], key: MetricKey
): Figure | null {
  return figures.find( ( f ) => f.key === key ) ?? null;
}

/**
 * The ONE figure a post is read by (lab 8, Q2): how many people it reached —
 * the network's Reach when it gives one (Instagram), else its Views or
 * Impressions. Named by the network's own label. Null when it gives neither.
 */
export function headline( figures: readonly Figure[] ): Figure | null {
  return figure(
    figures,
    "reach"
  ) ?? figure(
    figures,
    "views"
  );
}

/** How a headline reads after its number: `reached` for Reach, else the label in lower case (`views`, `impressions`). */
export function headlineWord( f: Figure ): string {
  return f.key === "reach" ? "reached" : f.label.toLowerCase();
}

/**
 * Saves + shares for a hundred people reached (lab 8, Q2) — only when the
 * network gives all three, and worded with ITS labels (`bookmarks + retweets
 * per 100 impressions` on X). Null otherwise: TikTok and Threads give no save.
 */
export function keepRate( figures: readonly Figure[] ): { value: number;
  words: string } | null {
  const head = headline( figures );
  const saves = figure(
    figures,
    "saves"
  );
  const shares = figure(
    figures,
    "shares"
  );

  if ( !head || !saves || !shares || head.value <= 0 ) {
    return null;
  }

  return {
    value: 100 * ( saves.value + shares.value ) / head.value,
    words: `${ saves.label.toLowerCase() } + ${ shares.label.toLowerCase() } per 100 ${ headlineWord( head ) }`
  };
}

/**
 * The networks whose provider in Postiz has NO post analytics at all: asking
 * would only ever answer `[]`, so nothing is asked and the row says so.
 */
export const NO_POST_FIGURES: ReadonlySet<Provider> = new Set<Provider>( [
  "bluesky",
  "other"
] );

/** `4,210`, `1.2k` is never written: a figure is shown whole. */
export function formatCount( n: number ): string {
  return Math.round( n ).toLocaleString( "en-GB" );
}

/** `2.1×`, `0.6×` — one decimal, two under 0.1. */
export function formatTimes( x: number ): string {
  return `${ x < 0.1 ? x.toFixed( 2 ) : x.toFixed( 1 ) }×`;
}

/** The middle of `values` (the mean of the two middles for an even count); null for none. */
export function median( values: readonly number[] ): number | null {
  if ( !values.length ) {
    return null;
  }

  const sorted = [
    ...values
  ].sort( (
    a, b
  ) => a - b );
  const mid = sorted.length >> 1;

  return sorted.length % 2 ? sorted[ mid ] : ( sorted[ mid - 1 ] + sorted[ mid ] ) / 2;
}
