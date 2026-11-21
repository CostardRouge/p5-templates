/**
 * Post statistics from the tab (`docs/memory/statistics.md`): what the
 * gallery shows of each post's figures and what the Plan listens to, read by
 * an agent through the same modules (`src/lib/stats/`) and the same kept
 * readings — so an agent and the person never see two different numbers.
 *
 * An agent reads figures; it must not embroider them. Every answer carries
 * the figures as the network gave them, when they were read and at what age,
 * and how many posts a comparison rests on; where there are too few it says
 * so instead of giving a number. Nothing here approves, schedules or sends.
 */
import {
  CommandError, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import type {
  GallerySend
} from "../../gallery/sends";
import {
  PROVIDER_LABEL, type PostizPost
} from "../../postiz/client";
import {
  allPublications
} from "../../postiz/publishStore";
import {
  DEFAULT_RHYTHM, slotLabel
} from "../../postiz/rhythm";
import {
  recentPosts
} from "../../postiz/recentPosts";
import {
  sketchKeyOf, sketchPath, type PlanSketch
} from "../../planner/planner";
import {
  knownSends
} from "../../stats/listen";
import {
  candidatesOf, groups, MIN_GROUP, MIN_USUAL, type GroupBy, type MeasuredAccount, type MeasuredSend
} from "../../stats/measure";
import {
  figuresOf, headline, keepRate, NO_POST_FIGURES
} from "../../stats/metrics";
import {
  heardPlan
} from "../../stats/plan";
import {
  readPosts
} from "../../stats/reader";
import {
  dueOnLook, dueReadings, RUN_BUDGET, unsupportedNow
} from "../../stats/schedule";
import {
  getStatsLevel, setStatsLevel, STATS_LEVELS, statsShown
} from "../../stats/settings";
import {
  MAX_SHIFT, MIN_EDGE
} from "../../stats/signal";
import {
  EARLY_DAYS, getStats, SETTLED_DAYS, type Reading
} from "../../stats/store";
import type {
  StudioHandles
} from "../handles";

const OFF = "statistics are off in this browser — the person turns them on in the menu › Publishing › Results (stats.set does it on their word)";
const NO_POSTIZ = "no Postiz is connected in this browser (menu › Publishing): there is nothing to read figures from";

/** What each network gives for a post, in Postiz's own labels (`src/lib/postiz/analytics.ts`). */
const NETWORK_FIGURES: Record<string, string> = {
  Instagram: "Views, Reach, Saves, Likes, Comments, Shares",
  TikTok: "Views, Likes, Comments, Shares",
  YouTube: "Views, Likes, Comments, Favorites",
  Threads: "Views, Likes, Replies, Reposts, Quotes",
  X: "Impressions, Likes, Retweets, Replies, Quotes, Bookmarks (nothing when the Postiz instance disables X analytics)",
  Bluesky: "nothing — Postiz reads no figure from Bluesky"
};

const round = ( n: number | null ) => n === null ? null : Math.round( n * 100 ) / 100;

function reading( r: Reading | undefined ) {
  return r ? {
    readAt: new Date( r.at ).toISOString(),
    ageDays: r.ageDays,
    figures: Object.fromEntries( r.figures.map( ( f ) => [
      f.label,
      f.value
    ] ) )
  } : null;
}

interface World {
  sends: GallerySend[];
  posts: PostizPost[] | null;
  catalogue: PlanSketch[];
  timeZone: string;
  now: number;
  calendarError: string | null;
  heard: ReturnType<typeof heardPlan>;
}

async function world( h: StudioHandles ): Promise<World> {
  const conn = h.publish.connection();
  const client = h.publish.client();
  const rhythm = conn?.rhythm ?? DEFAULT_RHYTHM;
  const now = Date.now();
  let posts: PostizPost[] | null = null;
  let calendarError: string | null = null;

  if ( client ) {
    try {
      posts = await recentPosts( client );
    } catch( caught ) {
      calendarError = caught instanceof Error ? caught.message : String( caught );
    }
  }

  const catalogue = h.navigation.catalogue() as PlanSketch[];
  const sends = knownSends(
    allPublications(),
    posts,
    conn?.channels ?? [],
    now,
    await h.gallery.store.entries().catch( () => [] )
  );

  return {
    sends,
    posts,
    catalogue,
    timeZone: rhythm.timeZone,
    now,
    calendarError,
    heard: heardPlan( {
      sends,
      catalogue,
      rhythm,
      now
    } )
  };
}

function account(
  a: MeasuredAccount, w: World
) {
  const usual = w.heard.heard.measured.usual.get( a.channelId );
  const shown = a.shown;
  const rate = shown ? keepRate( shown.figures ) : null;
  const head = shown ? headline( shown.figures ) : null;

  return {
    account: a.name,
    network: PROVIDER_LABEL[ a.provider ],
    postId: a.postId,
    state: a.stats === "figures"
      ? ( a.settled ? "settled (read 7 days or more after it went out)" : "not settled yet (read before 7 days: do not compare it)" )
      : a.stats === "no-network"
        ? "Postiz reads no figure from this network"
        : a.stats === "missing"
          ? "Postiz lost this post's id on the network: no figure until that is fixed in Postiz"
          : a.stats === "none" ? "asked, and Postiz had no figure" : "not read yet",
    ...( shown ? reading( shown ) : {} ),
    ...( head ? {
      headline: `${ head.label } ${ head.value }`
    } : {} ),
    ...( rate ? {
      rate: `${ round( rate.value ) } ${ rate.words }`
    } : {} ),
    timesUsual: round( a.index ),
    usual: usual ? {
      of: usual.label,
      value: usual.value,
      posts: usual.posts,
      ...( usual.value === null ? {
        note: `too few to say: ${ usual.posts } settled ${ usual.posts === 1 ? "post" : "posts" } on this account, ${ MIN_USUAL } needed`
      } : {} )
    } : null
  };
}

function send(
  s: MeasuredSend, w: World
) {
  const sketch = w.catalogue.find( ( c ) => sketchKeyOf( c ) === s.sketchKey );

  return {
    sketch: sketch ? sketchPath( sketch ) : s.sketchKey,
    at: new Date( s.at ).toISOString(),
    when: slotLabel(
      new Date( s.at ),
      w.timeZone
    ),
    slot: s.slot,
    pillar: s.pillar,
    series: s.series,
    piece: s.pieceId,
    timesUsual: round( s.index ),
    accounts: s.accounts.map( ( a ) => account(
      a,
      w
    ) )
  };
}

function sketchOrRefuse(
  h: StudioHandles, w: World, raw: unknown
): PlanSketch {
  const asked = String( raw ?? "current" ).replace(
    /^\/+|\/+$/g,
    ""
  );
  const path = asked === "current" ? h.navigation.currentSketch() : asked;
  const sketch = w.catalogue.find( ( s ) => sketchPath( s ) === path );

  if ( !sketch ) {
    throw new CommandError(
      "invalid",
      `no sketch "${ path }" — sketches.list shows them`
    );
  }

  return sketch;
}

const shown = () => statsShown() ? true as const : OFF;

export function statsCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "stats.status",
      title: "Read what statistics are doing",
      description: "Whether post statistics are on in this browser (off · show · listen), what is kept, what each network gives through Postiz, and the rules every figure is read by: a post is compared only by a reading taken 7 days or more after it went out, against the median of its OWN account («× your usual», from 5 such posts), and a group says nothing under 3 posts. Always available; asks Postiz nothing.",
      run() {
        const conn = h.publish.connection();
        const state = getStats();
        const records = Object.values( state.posts );

        return {
          level: getStatsLevel(),
          levels: STATS_LEVELS.map( ( l ) => `${ l.id }: ${ l.title }` ),
          postiz: conn ? "connected" : "not connected",
          ...( conn && unsupportedNow(
            state,
            conn.apiBase,
            Date.now()
          ) ? {
              problem: "this Postiz answered that it has no analytics route (an older version): nothing is asked for a day"
            } : {} ),
          kept: {
            posts: records.length,
            settled: records.filter( ( r ) => r.settled ).length,
            withoutFigures: records.filter( ( r ) => !r.last ).length
          },
          networks: NETWORK_FIGURES,
          rules: {
            earlyDays: EARLY_DAYS,
            settledDays: SETTLED_DAYS,
            usualFromPosts: MIN_USUAL,
            groupFromPosts: MIN_GROUP,
            planMovesAtMostPlaces: MAX_SHIFT,
            planNeedsALeadOf: MIN_EDGE,
            readsPerRun: RUN_BUDGET
          },
          note: "Figures live in this browser only: another device has none of them. A post made outside Sketchbook is never read. Never state a figure this does not give, and never call a post a success beyond what its numbers say."
        };
      }
    },
    {
      id: "stats.set",
      title: "Turn statistics off, on, or let the Plan listen",
      description: "The person's switch, per browser: off (nothing read, nothing shown, the Plan as it always was), show (each post's figures where its sends are), listen (and the Plan reorders its proposals by them, within bounds). Call it only when the person asked for it in the conversation — turning it on makes this tab ask their Postiz, which asks each network with their account's token. Answers stats.status.",
      params: {
        level: {
          type: "string",
          description: STATS_LEVELS.map( ( l ) => `${ l.id }: ${ l.title.toLowerCase() }` ).join( "; " ),
          enum: STATS_LEVELS.map( ( l ) => l.id )
        }
      },
      run( params ) {
        setStatsLevel( String( params.level ) as ReturnType<typeof getStatsLevel> );

        return {
          level: getStatsLevel()
        };
      }
    },
    {
      id: "stats.read",
      title: "Ask Postiz for the figures that are due",
      description: `Read from the person's Postiz the posts whose figures are due — one from its first day, one between ${ EARLY_DAYS } and ${ SETTLED_DAYS } days, one from ${ SETTLED_DAYS } days (the reading posts are compared by) — ${ RUN_BUDGET } posts a run at most, one request each, never the same post twice in 12 hours. With \`sketch\`, reads that sketch's posts that have not settled, as opening its sheet does. Each request makes Postiz ask the network with the account's token: do not call it in a loop. Answers { asked, figures, stopped, left }.`,
      params: {
        sketch: {
          type: "string",
          description: "\"engine/category/name\" from sketches.list, or \"current\" — only this sketch's posts",
          optional: true
        }
      },
      available: () => !statsShown() ? OFF : h.publish.client() ? true : NO_POSTIZ,
      async run( params ) {
        const client = h.publish.client();
        const conn = h.publish.connection();

        if ( !client || !conn ) {
          throw new CommandError(
            "unavailable",
            NO_POSTIZ
          );
        }

        const w = await world( h );

        if ( w.calendarError ) {
          throw new CommandError(
            "failed",
            `the person's Postiz did not answer: ${ w.calendarError }`
          );
        }

        const only = params.sketch === undefined ? null : sketchKeyOf( sketchOrRefuse(
          h,
          w,
          params.sketch
        ) );
        const candidates = candidatesOf(
          only ? w.sends.filter( ( s ) => s.sketchKey === only ) : w.sends,
          w.now
        );
        const pick = () => only
          ? dueOnLook(
            candidates,
            getStats(),
            Date.now(),
            conn.apiBase
          )
          : dueReadings(
            candidates,
            getStats(),
            Date.now(),
            conn.apiBase
          );
        const outcome = await readPosts(
          client,
          pick()
        );

        return {
          ...outcome,
          left: pick().length,
          notRead: candidates.filter( ( c ) => NO_POST_FIGURES.has( c.provider ) ).length,
          note: "left = posts still due after this run (the budget, or an early stop); notRead = posts on a network Postiz reads no figure from."
        };
      }
    },
    {
      id: "stats.sketch",
      title: "Read a sketch's posts and their figures",
      description: "Every send of one sketch that is out — this browser's and Sketchbook's from another device — with each account's figures exactly as its network gave them, when they were read and at what age, and how the post did against that account's usual (`timesUsual`, null when it cannot be said). Also the result of its series when the series has enough posts. From what is kept; stats.read asks Postiz first.",
      params: {
        sketch: {
          type: "string",
          description: "\"engine/category/name\" from sketches.list; the sketch open in the tab when omitted",
          optional: true
        }
      },
      available: shown,
      async run( params ) {
        const w = await world( h );
        const sketch = sketchOrRefuse(
          h,
          w,
          params.sketch
        );
        const mine = w.heard.heard.measured.sends.filter( ( s ) => s.sketchKey === sketchKeyOf( sketch ) );
        const series = sketch.category ? w.heard.heard.facts.series.get( sketch.category ) : undefined;

        return {
          sketch: sketchPath( sketch ),
          sends: mine.map( ( s ) => send(
            s,
            w
          ) ),
          series: series ? {
            name: series.label,
            posts: series.posts,
            timesUsual: round( series.index )
          } : null,
          note: mine.length
            ? "Compare two posts only by `timesUsual`, and only when both are settled. A figure absent from an account was not given by its network — it is not zero."
            : "No post of this sketch is out, as far as this browser and the Postiz calendar know. A post made outside Sketchbook is not attributed to a sketch."
        };
      }
    },
    {
      id: "stats.post",
      title: "Read one post's readings",
      description: "The readings kept of ONE Postiz post, by its id (from stats.sketch, publish.status or publish.calendar): the early one (2 to 7 days), the settled one (7 days or more — never rewritten) and the latest, each with its figures, when it was read and the post's age then. Asks Postiz nothing.",
      params: {
        id: {
          type: "string",
          description: "A Postiz post id"
        }
      },
      available: shown,
      async run( params ) {
        const id = String( params.id );
        const record = getStats().posts[ id ];
        const w = await world( h );
        const owner = w.heard.heard.measured.sends.find( ( s ) => s.accounts.some( ( a ) => a.postId === id ) );

        if ( !record && !owner ) {
          throw new CommandError(
            "invalid",
            `no post "${ id }" among Sketchbook's sends that are out — stats.sketch lists a sketch's posts with their ids`
          );
        }

        const mine = owner?.accounts.find( ( a ) => a.postId === id );

        return {
          postId: id,
          ...( owner ? {
            sketch: send(
              owner,
              w
            ).sketch,
            at: new Date( owner.at ).toISOString(),
            account: mine?.name,
            network: mine ? PROVIDER_LABEL[ mine.provider ] : undefined,
            timesUsual: round( mine?.index ?? null )
          } : {} ),
          early: reading( record?.early ),
          settled: reading( record?.settled ),
          last: reading( record?.last ),
          askedAt: record ? new Date( record.askedAt ).toISOString() : null,
          empty: record?.empty ?? null
        };
      }
    },
    {
      id: "stats.summary",
      title: "Read what works",
      description: "«What works», as under the gallery's Plan: each account's usual, then the measured sends grouped by pillar (new, favourite, series & recaps), by series or by slot of the rhythm — the median «× your usual» across accounts, or one account's raw medians with `account`. A group under 3 posts answers its count and `tooFew: true`, never a figure. Also what the Plan is listening to. From what is kept; asks Postiz nothing but its calendar.",
      params: {
        by: {
          type: "string",
          description: "pillar (the default), series or slot",
          enum: [
            "pillar",
            "series",
            "slot"
          ],
          optional: true
        },
        account: {
          type: "string",
          description: "An account id (publish.status lists them): its raw medians instead of the index across accounts",
          optional: true
        }
      },
      available: shown,
      async run( params ) {
        const w = await world( h );
        const by = ( params.by ?? "pillar" ) as GroupBy;
        const m = w.heard.heard.measured;
        const channel = params.account === undefined ? null : String( params.account );
        const usual = channel === null ? null : m.usual.get( channel );

        if ( channel !== null && !m.sends.some( ( s ) => s.accounts.some( ( a ) => a.channelId === channel ) ) ) {
          throw new CommandError(
            "invalid",
            `no measured post on account "${ channel }" — publish.status lists the accounts`
          );
        }

        return {
          by,
          measuredSends: w.heard.listening.measured,
          sendsOut: m.sends.length,
          accounts: [
            ...m.usual.values()
          ].map( ( u ) => {
            const named = m.sends.flatMap( ( s ) => s.accounts ).find( ( a ) => a.channelId === u.channelId );

            return {
              id: u.channelId,
              account: named?.name,
              network: named ? PROVIDER_LABEL[ named.provider ] : undefined,
              usual: u.value,
              of: u.label,
              settledPosts: u.posts,
              ...( u.value === null ? {
                tooFew: true
              } : {} )
            };
          } ),
          rows: groups(
            m.sends,
            by,
            channel
          ).map( ( row ) => ( {
            group: row.label,
            posts: row.posts,
            ...( row.thin ? {
              tooFew: true
            } : channel === null ? {
              timesUsual: round( row.index )
            } : {
              [ `median${ usual?.label ?? "Headline" }` ]: row.head,
              ...( row.rate !== null ? {
                savesPlusSharesPer100: round( row.rate )
              } : {} )
            } )
          } ) ),
          listening: w.heard.listening,
          note: [
            w.calendarError ? `The person's Postiz did not answer (${ w.calendarError }): only this browser's sends are known.` : null,
            "A row marked tooFew has under 3 measured posts: say so, do not compare it. The pillar of a send is the plan's word for its sketch TODAY (a favourite is today's star); a series or a recap reel is posted from the empty sketch, so the two cannot be told apart."
          ].filter( Boolean ).join( " " )
        };
      }
    },
    {
      id: "stats.accounts",
      title: "Ask Postiz for each account's own numbers",
      description: "What the person's Postiz gives for each ACCOUNT over the last days (followers, reach, views… — the labels differ by network and some give nothing): one request per account, on demand only. Each label's latest value and its date, exactly as given; Postiz's own «percentage change» is not read — it is a constant in its code, not a measurement.",
      params: {
        days: {
          type: "number",
          description: "The window in days, 7 by default",
          min: 1,
          max: 90,
          integer: true,
          optional: true
        }
      },
      available: () => !statsShown() ? OFF : h.publish.client() ? true : NO_POSTIZ,
      async run( params ) {
        const client = h.publish.client();
        const conn = h.publish.connection();

        if ( !client || !conn ) {
          throw new CommandError(
            "unavailable",
            NO_POSTIZ
          );
        }

        const days = Number( params.days ?? 7 );
        const out: unknown[] = [];

        for ( const channel of conn.channels.filter( ( c ) => !c.disabled ) ) {
          try {
            const series = await client.channelAnalytics(
              channel.id,
              days
            );

            out.push( {
              id: channel.id,
              account: channel.name,
              network: channel.identifier,
              figures: Object.fromEntries( figuresOf( series ).map( ( f ) => [
                f.label,
                f.value
              ] ) ),
              dated: series[ 0 ]?.points[ series[ 0 ].points.length - 1 ]?.date ?? null,
              ...( series.length ? {} : {
                note: "Postiz gave no figure for this account"
              } )
            } );
          } catch( caught ) {
            throw new CommandError(
              "failed",
              `the person's Postiz did not answer for ${ channel.name }: ${ caught instanceof Error ? caught.message : String( caught ) }`
            );
          }
        }

        return {
          days,
          readAt: new Date().toISOString(),
          accounts: out
        };
      }
    }
  ];
}
