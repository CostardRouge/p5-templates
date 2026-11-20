/**
 * The Plan's render queue at work (lab 7, pass 3): on a sketch's page, render
 * and SCHEDULE the approved line the run is on, then move the tab to the next
 * line's sketch — «tu le fais dans ton coin et moi je valide».
 *
 * Decided 2026-11-20: the queue walks the studio from sketch to sketch rather
 * than rendering from a hidden surface inside the gallery. A sketch page IS
 * the renderer — its engine, its form, its recorder, its reel import — and a
 * second, hidden one would be a second studio to keep true to the first. The
 * price is that the tab visibly navigates while it works; the run's state is
 * outside any page (`runStore`), so each mount picks it up where it was.
 *
 * One line, in order: the reel built (when it is one) · the approval checked
 * against the words as they stand · the slot checked against Postiz · the
 * variants its routes need rendered, each once · the slot checked AGAIN (a
 * Reel takes minutes; another app may have taken it) · one send through the
 * one send path (`sendRoutes`). It only ever SCHEDULES: «Publish now» keeps
 * its review screen in Export › Publish. A line that fails says why on the
 * line and the run goes on to the next.
 */

import type {
  ExportItemState
} from "../export/runExportBatch";
import type {
  ExportVariant
} from "../export/variants";
import type {
  StudioHandles
} from "../agent/handles";
import {
  postizWindow
} from "../gallery/calendar";
import type {
  PostizClient, PostizPost
} from "../postiz/client";
import {
  plannedInstants, type VariantSpan
} from "../postiz/plan";
import {
  setCurrentReel
} from "../postiz/postKey";
import {
  addPublication, getDraft
} from "../postiz/publishStore";
import {
  slotLabel
} from "../postiz/rhythm";
import {
  mimeOf, sendRoutes
} from "../postiz/send";
import type {
  PostizConnection
} from "../postiz/store";
import {
  lineDraft, linePlan, tickedAccounts, wordsStamp
} from "./approval";
import {
  getChoices, markOpened, patchLine
} from "./planStore";
import type {
  HeldLine
} from "./planner";
import {
  reelDocument
} from "./reel";
import {
  getRun, ownsRun, subscribeRun, updateRun, type PlanRun
} from "./runStore";
import {
  postShape, variantFormat
} from "../postiz/postShape";
import {
  wantedVariants
} from "./usualVariants";
import {
  planFreeSlots
} from "./slots";

/** How long a page may take to have its engine running. */
const READY_TIMEOUT_MS = 60_000;
/** How long a running page may take to say whether this browser can encode. */
const ENCODER_TIMEOUT_MS = 15_000;
/** A reel just built: its form reset reaches the engine a frame later. */
const REEL_SETTLE_MS = 1_200;

const sleep = ( ms: number ) => new Promise<void>( ( resolve ) => setTimeout(
  resolve,
  ms
) );

/** A line that cannot go, with the reason the person reads on it. */
export class LineError extends Error {
  /** The words changed since they were approved: the line waits for a new approval, it did not fail. */
  readonly reworded: boolean;

  constructor(
    message: string, reworded = false
  ) {
    super( message );
    this.name = "LineError";
    this.reworded = reworded;
  }
}

/** The posts already on a slot's exact instant that hold it (drafts and failures hold nothing). Pure. */
export function postsOnSlot(
  posts: readonly { id: string;
    publishDate: string;
    state: string }[], slot: string
): string[] {
  const at = Date.parse( slot );

  return posts.filter( ( p ) => p.state !== "error" && p.state !== "draft" && Date.parse( p.publishDate ) === at ).map( ( p ) => p.id );
}

/**
 * Why a line's slot can no longer be scheduled on, or null — asked of the
 * calendar as it is NOW, by the plan's own rule (`planFreeSlots`: every app's
 * posts count, a live post that day closes it). Pure.
 */
export function slotProblem(
  conn: Pick<PostizConnection, "rhythm">,
  posts: readonly { publishDate: string;
    state: string }[],
  slot: string,
  now: Date
): string | null {
  const at = new Date( slot );

  if ( !( at.getTime() > now.getTime() ) ) {
    return "Its slot went by before it could be sent.";
  }

  // The plan looks five weeks ahead; a slot further away is judged by its own day.
  const weeks = Math.ceil( ( at.getTime() - now.getTime() ) / ( 7 * 86_400_000 ) ) + 1;
  const free = planFreeSlots(
    conn.rhythm,
    posts,
    now,
    weeks
  ).some( ( d ) => d.getTime() === at.getTime() );

  return free ? null : `Another post took ${ slotLabel(
    at,
    conn.rhythm.timeZone
  ) } meanwhile — nothing was sent. Skip the line, or ask for another slot.`;
}

async function readCalendar(
  client: PostizClient, slot: string
): Promise<PostizPost[]> {
  const span = postizWindow( Date.now() );
  const to = new Date( Math.max(
    span.to.getTime(),
    Date.parse( slot ) + 8 * 86_400_000
  ) );

  try {
    return await client.posts(
      span.from,
      to
    );
  } catch( caught ) {
    throw new LineError( `Your Postiz did not answer when the slot was checked (${ caught instanceof Error ? caught.message : String( caught ) }) — nothing was sent.` );
  }
}

function spansOf( h: StudioHandles ): VariantSpan[] {
  return h.exports.list().map( ( variant ) => ( {
    variant,
    slideSpan: h.publish.slideSpan( variant ),
    size: h.publish.variantSize( variant )
  } ) );
}

/** 0–1 of a render, from the recorder's own feed. */
function progressOf( items: readonly ExportItemState[] ): number | null {
  if ( !items.length ) {
    return null;
  }

  const done = items.reduce(
    (
      sum, item
    ) => sum + ( item.status === "done" ? 1 : Math.max(
      0,
      Math.min(
        1,
        ( item.percentage ?? 0 ) / 100
      )
    ) ),
    0
  );

  return done / items.length;
}

export interface LineReport {
  ( phase: string, progress?: number | null ): void;
}

/**
 * Render and schedule ONE approved line on the page that shows its sketch.
 * Resolves once it is in Postiz; throws a `LineError` saying why it is not.
 */
export async function runLine(
  h: StudioHandles, slot: string, line: HeldLine, signal: AbortSignal, report: LineReport
): Promise<{ postIds: string[];
  recovered: boolean }> {
  const conn = h.publish.connection();
  const client = h.publish.client();

  if ( !conn || !client ) {
    throw new LineError( "No Postiz is connected in this browser — connect it in Menu › Publishing." );
  }

  const exportable = h.exports.supported();

  if ( exportable !== true ) {
    throw new LineError( exportable );
  }

  if ( line.proposal.reel ) {
    const document = reelDocument( line.proposal );
    const built = document ? h.gallery.importDocument( document ) : {
      ok: false,
      reason: "the reel has no scene"
    };

    if ( !built.ok ) {
      throw new LineError( `The reel could not be built: ${ built.reason ?? "unknown reason" }` );
    }
    // Its words live under the reel's own key, not the host's.
    setCurrentReel( line.proposal.key );
    markOpened( line.proposal.key );
    report( "building the reel" );
    await h.exports.warm?.( line.proposal.reel.scenes );
    await sleep( REEL_SETTLE_MS );
  }

  const draft = lineDraft(
    line.proposal,
    getDraft( line.postKey )
  );

  // The approval covers the words as they were shown. Anything changed since
  // — by the person or by an agent — and this line is not approved any more.
  if ( line.stamp === null || wordsStamp(
    draft,
    conn
  ) !== line.stamp ) {
    throw new LineError(
      "Its words changed after you approved them — read them and approve again.",
      true
    );
  }
  if ( !tickedAccounts(
    draft,
    conn
  ).length ) {
    throw new LineError( "No account is ticked for this post — tick one in Export › Publish." );
  }

  report( "checking the slot" );

  let posts = await readCalendar(
    client,
    slot
  );

  // A run cut between the post request and its answer may have sent this
  // line: a post standing on its exact instant is that post, never a reason
  // to send a second one.
  if ( line.sending ) {
    const there = postsOnSlot(
      posts,
      slot
    );

    if ( there.length ) {
      return {
        postIds: there,
        recovered: true
      };
    }
  }

  const before = slotProblem(
    conn,
    posts,
    slot,
    new Date()
  );

  if ( before ) {
    throw new LineError( before );
  }

  // Each account's usual format, when this sketch has no variant of it yet.
  for ( const wanted of wantedVariants(
    conn.usual,
    tickedAccounts(
      draft,
      conn
    ),
    spansOf( h ).map( ( v ) => variantFormat(
      postShape(
        v.variant,
        v.slideSpan
      ),
      v.size
    ) ),
    h.exports.presets
  ) ) {
    const added = h.exports.add( wanted.preset );

    if ( Object.keys( wanted.patch ).length ) {
      h.exports.patch(
        added.id,
        wanted.patch
      );
    }
  }

  const plan = linePlan( {
    conn,
    proposal: line.proposal,
    draft,
    slot,
    spans: spansOf( h ),
    facts: h.publish.facts(),
    planned: plannedInstants( posts )
  } );

  if ( plan.blocked || !plan.routes.length || !( plan.at instanceof Date ) ) {
    throw new LineError( plan.blocked ?? "Nothing can be posted as this post stands." );
  }

  report(
    "rendering",
    0
  );

  const produced = new Map<string, File[]>();
  const items = await h.exports.run(
    plan.variants as ExportVariant[],
    (
      variantId, artifacts
    ) => {
      produced.set(
        variantId,
        artifacts.map( ( artifact ) => new File(
          [
            artifact.blob
          ],
          artifact.fileName,
          {
            type: mimeOf(
              artifact.fileName,
              artifact.blob.type
            )
          }
        ) )
      );
    },
    ( states ) => report(
      "rendering",
      progressOf( states )
    ),
    signal
  );

  if ( signal.aborted ) {
    throw new LineError( "Stopped before it was sent." );
  }

  const failed = items.find( ( item ) => item.status !== "done" );

  if ( failed || plan.variants.some( ( v ) => !produced.get( v.id )?.length ) ) {
    throw new LineError( `The render did not finish${ failed?.error ? `: ${ failed.error }` : "" }.` );
  }

  const files = new Map<string, File[]>();

  for ( const [
    id,
    list
  ] of produced ) {
    const out: File[] = [];

    for ( const file of list ) {
      out.push( await h.publish.postable( file ) );
    }
    files.set(
      id,
      out
    );
  }

  // The render took its time: the slot is asked for again right before the send.
  report( "checking the slot again" );
  posts = await readCalendar(
    client,
    slot
  );

  const after = slotProblem(
    conn,
    posts,
    slot,
    new Date()
  );

  if ( after ) {
    throw new LineError( after );
  }
  if ( signal.aborted ) {
    throw new LineError( "Stopped before it was sent." );
  }

  report( "sending" );
  patchLine(
    slot,
    {
      sending: true
    }
  );

  let publication;

  try {
    publication = await sendRoutes( {
      client,
      routes: plan.routes,
      files,
      at: plan.at,
      signal
    } );
  } catch( caught ) {
    // Postiz said no (or the request never left): nothing of this line is out.
    if ( !( caught instanceof TypeError ) ) {
      patchLine(
        slot,
        {
          sending: undefined
        }
      );
    }
    throw new LineError( caught instanceof Error ? caught.message : String( caught ) );
  }

  addPublication(
    line.postKey,
    publication
  );
  h.publish.remember( Object.fromEntries( plan.routes.map( ( r ) => [
    r.channel.id,
    r.format
  ] ) ) );

  return {
    postIds: publication.postIds,
    recovered: false
  };
}

/** The first line of the run, from `index` on, that still waits to be rendered. */
function nextWaiting(
  run: PlanRun, from: number
): number {
  const held = getChoices().held;

  for ( let i = from; i < run.slots.length; i++ ) {
    const line = held[ run.slots[ i ] ];

    if ( line && line.state !== "planned" ) {
      return i;
    }
  }

  return run.slots.length;
}

/**
 * Let THIS page work on the run this tab owns: called by the sketch page once
 * its commands' handles exist, again on every mount. Answers the cleanup.
 */
export function attachPlanRunner( h: StudioHandles ): () => void {
  let alive = true;
  let busy = false;
  let controller: AbortController | null = null;
  let heart: ReturnType<typeof setInterval> | null = null;

  const stopHeart = () => {
    if ( heart ) {
      clearInterval( heart );
      heart = null;
    }
  };

  /** Every line was tried: the run is over, and the tab goes back where it was started from. */
  const finish = ( run: PlanRun ) => {
    stopHeart();
    updateRun(
      run.id,
      ( r ) => ( {
        ...r,
        index: Math.max(
          0,
          r.slots.length - 1
        ),
        state: "done",
        phase: "done",
        progress: null,
        beat: Date.now()
      } )
    );
    if ( run.origin && !run.origin.startsWith( "/sketches/" ) ) {
      h.navigation.open( run.origin );
    }
  };

  const step = async() => {
    const run = getRun();

    if ( !alive || busy || !run || run.state !== "running" || !ownsRun( run ) ) {
      return;
    }

    busy = true;
    try {
      const index = nextWaiting(
        run,
        run.index
      );

      if ( index >= run.slots.length ) {
        finish( run );

        return;
      }

      const slot = run.slots[ index ];
      const line = getChoices().held[ slot ];

      updateRun(
        run.id,
        ( r ) => ( {
          ...r,
          index,
          phase: "opening the sketch",
          progress: null,
          beat: Date.now()
        } )
      );
      if ( !heart ) {
        heart = setInterval(
          () => updateRun(
            run.id,
            ( r ) => r.state === "running" ? {
              ...r,
              beat: Date.now()
            } : r
          ),
          3_000
        );
      }

      // Not this line's sketch: the tab goes there, and that page's mount carries on.
      if ( line.proposal.path !== h.sketchId ) {
        h.navigation.open( `/sketches/${ line.proposal.path }` );

        return;
      }

      const started = Date.now();
      const deadline = started + READY_TIMEOUT_MS;

      // The engine starts and the encoder is probed after the page mounts.
      while ( alive && !( h.exports.ready() && h.exports.supported() === true ) && Date.now() < Math.min(
        deadline,
        h.exports.ready() ? started + ENCODER_TIMEOUT_MS : deadline
      ) ) {
        await sleep( 150 );
      }
      if ( !alive ) {
        return;
      }

      controller = new AbortController();

      const report = (
        phase: string, progress: number | null = null
      ) => updateRun(
        run.id,
        ( r ) => r.state === "running" ? {
          ...r,
          phase,
          progress,
          beat: Date.now()
        } : r
      );

      patchLine(
        slot,
        {
          state: "rendering",
          error: undefined
        }
      );

      try {
        if ( !h.exports.ready() ) {
          throw new LineError( "The sketch did not start within a minute." );
        }

        const sent = await runLine(
          h,
          slot,
          line,
          controller.signal,
          report
        );

        patchLine(
          slot,
          {
            state: "planned",
            postIds: sent.postIds,
            sending: undefined,
            error: undefined,
            ms: Date.now() - started
          }
        );
      } catch( caught ) {
        const stopped = controller.signal.aborted;
        const reworded = caught instanceof LineError && caught.reworded;

        // Stopped by the person or by leaving the page: the line waits as it
        // was, still approved. Reworded: it waits for a new approval.
        patchLine(
          slot,
          stopped ? {
            state: "waiting"
          } : reworded ? {
            state: "waiting",
            stamp: null,
            error: caught.message
          } : {
            state: "failed",
            error: caught instanceof Error ? caught.message : String( caught ),
            ms: Date.now() - started
          }
        );
        if ( stopped ) {
          return;
        }
      } finally {
        controller = null;
      }

      if ( !alive ) {
        return;
      }

      const next = nextWaiting(
        run,
        index + 1
      );

      if ( getRun()?.state !== "running" ) {
        return;
      }
      if ( next >= run.slots.length ) {
        finish( run );

        return;
      }
      updateRun(
        run.id,
        ( r ) => r.state === "running" ? {
          ...r,
          index: next,
          phase: "next",
          progress: null,
          beat: Date.now()
        } : r
      );
    } finally {
      busy = false;
    }
    // One line done, whatever became of it: on to the next.
    void step();
  };

  // A run started while this page is open (an agent's `plan.render`), or
  // cancelled from the gallery in another tab.
  const off = subscribeRun( () => {
    const run = getRun();

    if ( run?.state === "cancelled" ) {
      controller?.abort();
      stopHeart();
    } else if ( !busy ) {
      void step();
    }
  } );

  void step();

  return () => {
    alive = false;
    off();
    stopHeart();
    controller?.abort();
  };
}
