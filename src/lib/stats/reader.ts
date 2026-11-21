/**
 * Asking Postiz about the posts that are due, from the TAB like every Postiz
 * request here (`publishing.md`: the key never reaches the server): one at a
 * time, never in parallel, stopping at the first sign that asking is useless —
 * a Postiz without the route (404, remembered for a day), a refused key, no
 * answer. A post Postiz has no figure for is remembered as asked, so it is
 * left alone for the retry delay.
 */

import {
  PostizError, type PostizClient
} from "../postiz/client";
import type {
  Candidate
} from "./schedule";
import {
  keepAnswer, markUnsupported
} from "./store";

export interface ReadOutcome {
  /** Posts asked about. */
  asked: number;
  /** Of them, how many gave figures. */
  figures: number;
  /** Why the run stopped early, in words for the person; null when it ran through. */
  stopped: string | null;
}

export const NO_ROUTE = "Your Postiz has no analytics in its public API — it is probably an older version. Update it, then read again.";

/** One run at a time per tab: the gallery and a command may both ask. */
let running: Promise<ReadOutcome> | null = null;

export function readPosts(
  client: Pick<PostizClient, "postAnalytics" | "apiBase">,
  posts: readonly Candidate[],
  now: () => number = Date.now
): Promise<ReadOutcome> {
  if ( running ) {
    return running;
  }

  const run = ( async(): Promise<ReadOutcome> => {
    const outcome: ReadOutcome = {
      asked: 0,
      figures: 0,
      stopped: null
    };

    for ( const post of posts ) {
      try {
        const answer = await client.postAnalytics( post.postId );

        outcome.asked += 1;
        if ( answer.kind === "figures" ) {
          outcome.figures += 1;
        }
        keepAnswer(
          post.postId,
          post.publishedAt,
          answer,
          now()
        );
      } catch( caught ) {
        if ( caught instanceof PostizError && caught.status === 404 ) {
          markUnsupported(
            client.apiBase,
            now()
          );
          outcome.stopped = NO_ROUTE;
        } else {
          outcome.stopped = caught instanceof Error ? caught.message : String( caught );
        }
        break;
      }
    }

    if ( outcome.asked > 0 ) {
      // It answered: whatever was remembered of a missing route is over.
      markUnsupported(
        null,
        now()
      );
    }

    return outcome;
  } )();

  running = run;
  void run.finally( () => {
    if ( running === run ) {
      running = null;
    }
  } );

  return run;
}
