/**
 * What Postiz's public API says of a post's and an account's numbers — read
 * in Postiz's own source on 2026-11-20 (`gitroomhq/postiz-app`, `main`:
 * `public.integrations.controller.ts`, `posts.service.ts`,
 * `integration.service.ts` and each network's provider), never guessed:
 *
 * - `GET /analytics/post/:postId?date=<days>` → `[{ label, data: [{ total, date }], percentageChange }]`,
 *   ONE point per label, today's total. `[]` when the post is not out, when
 *   the network's provider reads none, when the account's token could not be
 *   refreshed, or when the network refused; `{ missing: true }` when Postiz
 *   published the post but lost its id on the network.
 * - `GET /analytics/:integration?date=<days>` → the same shape for an account,
 *   a point a day for some labels and one total for others.
 *
 * What each network's provider returns FOR A POST (its labels, verbatim):
 * Instagram (both kinds of account) Views, Reach, Saves, Likes, Comments,
 * Shares · TikTok Views, Likes, Comments, Shares · YouTube Views, Likes,
 * Comments, Favorites · Threads Views, Likes, Replies, Reposts, Quotes ·
 * X Impressions, Likes, Retweets, Replies, Quotes, Bookmarks (nothing when
 * the instance sets `DISABLE_X_ANALYTICS`) · Bluesky nothing at all.
 *
 * `percentageChange` is NOT a measurement: the providers write a constant
 * there (5 for an account, 0 for a post). It is read by nobody here.
 *
 * Postiz keeps an answer for an hour (Redis), and every miss is a call to the
 * network with the account's own token — X's counts against the API quota of
 * the instance's X app. So these are read sparingly (`src/lib/stats/schedule.ts`).
 *
 * Pure and DOM-free; `PostizClient.postAnalytics` / `.channelAnalytics` wire
 * them to a `fetch`.
 */

/** One label of an answer: Postiz's own word for it, and its points in time order. */
export interface AnalyticsSeries {
  /** As Postiz wrote it: `Reach`, `Impressions`, `Follower Count`… */
  label: string;
  points: { total: number;
    /** `YYYY-MM-DD`, the day Postiz dates the total. */
    date: string }[];
}

/** What Postiz answered about ONE post. */
export type PostAnalytics =
  /** Figures, label by label. */
  | { kind: "figures";
    series: AnalyticsSeries[] }
  /** Postiz published it but does not know its id on the network (its own «missing» state): no figure can be read until that is fixed in Postiz. */
  | { kind: "missing" }
  /** An empty answer: not out yet, a network Postiz reads nothing from, a token it could not refresh, or the network's refusal — Postiz does not say which. */
  | { kind: "none" };

function total( raw: unknown ): number | null {
  // Postiz writes a post's totals as strings and an account's as numbers.
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number( raw ) : NaN;

  return Number.isFinite( n ) ? n : null;
}

/** The series of an analytics answer, whatever extra fields a version adds; a label with no readable total is left out, never filled. */
export function readAnalytics( raw: unknown ): AnalyticsSeries[] {
  if ( !Array.isArray( raw ) ) {
    return [];
  }

  return raw.flatMap( ( x ) => {
    if ( !x || typeof x !== "object" ) {
      return [];
    }

    const r = x as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const points = ( Array.isArray( r.data ) ? r.data : [] ).flatMap( ( p ) => {
      const point = ( p && typeof p === "object" ? p : {} ) as Record<string, unknown>;
      const value = total( point.total );

      return value === null ? [] : [
        {
          total: value,
          date: typeof point.date === "string" ? point.date : ""
        }
      ];
    } );

    return label && points.length ? [
      {
        label,
        points
      }
    ] : [];
  } );
}

/** One post's answer: figures, Postiz's «missing», or nothing. */
export function readPostAnalytics( raw: unknown ): PostAnalytics {
  if ( raw && typeof raw === "object" && !Array.isArray( raw ) && ( raw as { missing?: unknown } ).missing === true ) {
    return {
      kind: "missing"
    };
  }

  const series = readAnalytics( raw );

  return series.length ? {
    kind: "figures",
    series
  } : {
    kind: "none"
  };
}
