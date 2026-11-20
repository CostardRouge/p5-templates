/**
 * The plan from the tab (lab 7, `docs/memory/publishing.md`): what the
 * gallery's Plan view proposes for each free slot of the rhythm, read and
 * steered by an agent — the same calculation (`src/lib/planner/`), the same
 * choices kept in this browser, so what an agent pins or passes over shows in
 * the gallery and what the person skipped there is skipped here.
 *
 * An agent PROPOSES. Nothing here approves words or sends anything: a post
 * still goes through `publish.*`, and `publish.approve` only on the person's
 * word. There is no `plan.approve`, on purpose.
 */
import {
  CommandError, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import {
  DEFAULT_RHYTHM, slotHead, slotLabel
} from "../../postiz/rhythm";
import {
  allPublications, getDraft, patchDraft, setWhen
} from "../../postiz/publishStore";
import {
  postKeyOfProposal, setCurrentReel, stageReel
} from "../../postiz/postKey";
import {
  lineDraft, lineStatus, queueable, wordsStamp, type LineStatus
} from "../../planner/approval";
import {
  cancelRun, claimRun, getRun, runAlive, runInterrupted, startRun, updateRun
} from "../../planner/runStore";
import {
  recentPosts
} from "../../postiz/recentPosts";
import {
  askPlanned
} from "../../postiz/reopen";
import {
  GAP_WEEKS, MIXES, monthRecap, PIN_REEL_MAX, PLAN_WEEKS, planSlots, playable, REEL_HOST, reelOf, sketchKeyOf, sketchPath, tooSoon, yearRecap, type Pin, type PlanSketch, type PlanSlot
} from "../../planner/planner";
import {
  sketchTitle
} from "../../postiz/caption";
import {
  localDay
} from "../../postiz/rhythm";
import {
  getChoices, markOpened, passProposal, patchLine, pinSlot, resetPlan, skipSlot, updateChoices
} from "../../planner/planStore";
import {
  reelCaption, reelDocument, reelSeconds
} from "../../planner/reel";
import {
  postedFrom, type Posted
} from "../../planner/posted";
import {
  planFreeSlots
} from "../../planner/slots";
import type {
  StudioHandles
} from "../handles";
import {
  until
} from "./slideCommands";

const OPEN_TIMEOUT_MS = 60_000;

const AT_PARAM = {
  at: {
    type: "string" as const,
    description: "A slot of plan.get, as its `at` (an ISO instant)"
  }
};

interface Reading {
  slots: PlanSlot[];
  posted: Posted[];
  catalogue: PlanSketch[];
  /** False when no Postiz is kept: the default rhythm, and only this browser's sends. */
  connected: boolean;
  timeZone: string;
  rhythm: string;
  /** Why Postiz's calendar could not be read, when it could not. */
  calendarError: string | null;
  /** Where each line stands (`approval.ts`), by slot. */
  status: Map<string, LineStatus>;
}

async function readPlan( h: StudioHandles ): Promise<Reading> {
  const conn = h.publish.connection();
  const client = h.publish.client();
  const rhythm = conn?.rhythm ?? DEFAULT_RHYTHM;
  const now = Date.now();
  let posts: Awaited<ReturnType<typeof recentPosts>> | null = null;
  let calendarError: string | null = null;

  if ( client ) {
    try {
      posts = await recentPosts( client );
    } catch( caught ) {
      calendarError = caught instanceof Error ? caught.message : String( caught );
    }
  }

  const catalogue = h.navigation.catalogue() as PlanSketch[];
  const posted = postedFrom(
    allPublications(),
    posts
  );

  const slots = planSlots( {
    catalogue,
    slots: planFreeSlots(
      rhythm,
      posts ?? [],
      new Date( now )
    ),
    posted,
    choices: getChoices(),
    now,
    timeZone: rhythm.timeZone
  } );
  const running = runAlive(
    getRun(),
    now
  );
  const status = new Map<string, LineStatus>();

  for ( const slot of slots ) {
    const line = slot.held;
    const stamp = line && conn ? wordsStamp(
      lineDraft(
        line.proposal,
        getDraft( line.postKey )
      ),
      conn
    ) : null;
    const standing = lineStatus(
      slot,
      stamp,
      running
    );

    // Words changed since the approval: it is taken back for good, not only
    // for as long as they stay changed.
    if ( line && standing === "reworded" && line.stamp !== null ) {
      patchLine(
        slot.slot,
        {
          stamp: null
        }
      );
    }
    status.set(
      slot.slot,
      standing
    );
  }

  return {
    catalogue,
    posted,
    connected: Boolean( conn ),
    timeZone: rhythm.timeZone,
    rhythm: rhythm.slots.map( slotHead ).join( " · " ),
    calendarError,
    slots,
    status
  };
}

const STATUS_WORDS: Record<LineStatus, string> = {
  empty: "nothing left",
  skipped: "skipped",
  proposed: "proposed",
  pinned: "pinned",
  approved: "approved by the person — waits for the render queue",
  reworded: "its words changed after the person approved — it waits for THEIR approval again",
  taken: "approved, but another post took its slot",
  rendering: "rendering",
  planned: "planned in Postiz",
  failed: "failed"
};

function describe(
  slot: PlanSlot, timeZone: string, standing?: LineStatus
) {
  const p = slot.proposal;
  const line = slot.held;

  return {
    at: slot.slot,
    when: slotLabel(
      slot.at,
      timeZone
    ),
    state: line && standing ? STATUS_WORDS[ standing ] : slot.skipped ? "skipped" : !p ? "nothing left" : p.pin ? `pinned by ${ p.pin.by === "agent" ? "an agent" : "the person" }` : "proposed",
    ...( line ? {
      approved: standing === "approved" || standing === "failed" || standing === "rendering" || standing === "planned",
      ...( line.error ? {
        error: line.error
      } : {} ),
      ...( line.postIds ? {
        postIds: line.postIds
      } : {} ),
      ...( line.ms ? {
        seconds_taken: Math.round( line.ms / 1000 )
      } : {} )
    } : {} ),
    ...( p ? {
      sketch: p.path,
      title: p.title,
      pillar: p.pillar,
      favorite: p.favorite,
      why: p.why,
      key: p.key,
      ...( p.reel ? {
        reel: p.reel.scenes.map( ( scene ) => `p5/${ scene }` ),
        seconds: reelSeconds( p.reel.scenes.length )
      } : {} )
    } : {} )
  };
}

/** The render queue as it stands, or null when none was started. */
function describeRun() {
  const run = getRun();

  if ( !run ) {
    return null;
  }

  const now = Date.now();
  const held = getChoices().held;

  return {
    state: run.state === "running" ? ( runAlive(
      run,
      now
    ) ? "running" : "interrupted — its tab went away; plan.render resumes it" ) : run.state,
    line: Math.min(
      run.index + 1,
      run.slots.length
    ),
    of: run.slots.length,
    ...( run.state === "running" ? {
      phase: run.phase,
      ...( run.progress !== null ? {
        progress: Math.round( run.progress * 100 ) / 100
      } : {} )
    } : {} ),
    lines: run.slots.map( ( slot ) => ( {
      at: slot,
      state: held[ slot ]?.state ?? "gone",
      ...( held[ slot ]?.error ? {
        error: held[ slot ].error
      } : {} )
    } ) )
  };
}

async function answer( h: StudioHandles ) {
  const reading = await readPlan( h );
  const choices = getChoices();

  return {
    rhythm: reading.rhythm,
    timeZone: reading.timeZone,
    mix: choices.mix,
    gapWeeks: choices.gapWeeks,
    weeks: PLAN_WEEKS,
    slots: reading.slots.map( ( slot ) => describe(
      slot,
      reading.timeZone,
      reading.status.get( slot.slot )
    ) ),
    run: describeRun(),
    note: [
      reading.connected ? null : "No Postiz is connected in this browser: the default rhythm is drawn and only this browser's sends are known.",
      reading.calendarError ? `The person's Postiz did not answer (${ reading.calendarError }): taken slots are not known.` : null,
      "A proposal is not a post. The person approves lines in the gallery's Plan — no command does; plan.render then renders and schedules what THEY approved. plan.open puts one line on Export › Publish; publish.approve stays the person's word."
    ].filter( Boolean ).join( " " )
  };
}

type PinReel = NonNullable<Pin[ "reel" ]>;

/** The sketches named by `paths`, each one existing and able to play in a reel — or the refusal that says which is not. */
export function playableSketches(
  catalogue: readonly PlanSketch[], paths: unknown
): PlanSketch[] {
  const list = Array.isArray( paths ) ? paths.map( ( path ) => String( path ).replace(
    /^\/+|\/+$/g,
    ""
  ) ) : [];

  if ( list.length < 2 || list.length > PIN_REEL_MAX ) {
    throw new CommandError(
      "invalid",
      `a reel takes 2 to ${ PIN_REEL_MAX } sketches — ${ list.length } given`
    );
  }

  return list.map( ( path ) => {
    const sketch = catalogue.find( ( s ) => sketchPath( s ) === path );

    if ( !sketch ) {
      throw new CommandError(
        "invalid",
        `no sketch "${ path }" — sketches.list shows them`
      );
    }
    if ( !playable( sketch ) ) {
      throw new CommandError(
        "invalid",
        `${ path } cannot be a scene of a reel (it is not a p5 sketch, it is hidden, it draws asynchronously, or it waits for a camera, a microphone or a file)`
      );
    }

    return sketch;
  } );
}

function chosenReel(
  reading: Reading, paths: unknown, title: string
): PinReel {
  const sketches = playableSketches(
    reading.catalogue,
    paths
  );
  const series = new Set( sketches.map( ( s ) => s.category ?? s.name ) );
  const name = series.size === 1 && sketches[ 0 ].category
    ? sketchTitle(
      sketches[ 0 ].category,
      null
    )
    : "Selection";

  return {
    title: title.trim() || name,
    subtitle: `${ sketches.length } SKETCHES`,
    sketches: sketches.map( sketchKeyOf ),
    pillar: "series"
  };
}

function recapReel(
  reading: Reading, period: string
): PinReel {
  if ( !/^\d{4}(-(0[1-9]|1[0-2]))?$/.test( period ) ) {
    throw new CommandError(
      "invalid",
      `recap "${ period }" is not a month nor a year — "2026-11" or "2026"`
    );
  }

  const proposal = period.length === 4
    ? yearRecap(
      reading.catalogue,
      period
    )
    : monthRecap(
      reading.catalogue,
      reading.posted,
      period,
      reading.timeZone
    );

  if ( !proposal?.reel ) {
    throw new CommandError(
      "invalid",
      `nothing to recap for ${ period }: fewer than three sketches were posted or made then (plan.posted lists what was posted)`
    );
  }

  return {
    title: proposal.title,
    subtitle: proposal.reel.subtitle,
    sketches: proposal.reel.sketches,
    pillar: "recap"
  };
}

async function slotOrRefuse(
  h: StudioHandles, at: unknown
): Promise<{ slot: PlanSlot;
  reading: Reading }> {
  const when = Date.parse( String( at ) );

  if ( !Number.isFinite( when ) ) {
    throw new CommandError(
      "invalid",
      `at "${ String( at ) }" is not an instant — give a slot's \`at\` from plan.get`
    );
  }

  const reading = await readPlan( h );
  const slot = reading.slots.find( ( s ) => s.at.getTime() === when );

  if ( !slot ) {
    throw new CommandError(
      "invalid",
      `${ new Date( when ).toISOString() } is not a free slot of the plan — plan.get lists them (a slot with a post already on it, or on its day, is not offered)`
    );
  }

  return {
    slot,
    reading
  };
}

export function planCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "plan.get",
      title: "Read the plan",
      description: "What to post next: one line per FREE slot of the person's rhythm over the next five weeks, each with what is proposed for it and why — a new sketch in the order of its series, a favourite not posted recently, a whole SERIES as one Reel, or a RECAP of the month or the year. The same plan as the gallery's Plan view. Answers { rhythm, mix, gapWeeks, slots: [{ at, when, state, sketch, title, pillar, why, key, reel?, seconds? }] }; a series or a recap has `reel` (its sketches in order) and its `sketch` is the empty host it is built on. It reads the calendar; it sends nothing.",
      run: () => answer( h )
    },
    {
      id: "plan.set",
      title: "Change the plan's rules",
      description: "The mix of new sketches and favourites, and how many weeks must pass between two posts of one sketch. Answers the plan as it is afterwards.",
      params: {
        mix: {
          type: "string",
          description: MIXES.map( ( m ) => `${ m.id }: ${ m.title.toLowerCase() }` ).join( "; " ),
          enum: MIXES.map( ( m ) => m.id ),
          optional: true
        },
        gapWeeks: {
          type: "number",
          description: `Weeks between two posts of one sketch: ${ GAP_WEEKS.join( ", " ) }`,
          integer: true,
          optional: true
        }
      },
      run( params ) {
        if ( params.gapWeeks !== undefined && !( GAP_WEEKS as readonly number[] ).includes( Number( params.gapWeeks ) ) ) {
          throw new CommandError(
            "invalid",
            `gapWeeks ${ String( params.gapWeeks ) } is not offered — ${ GAP_WEEKS.join( ", " ) }`
          );
        }

        updateChoices( ( c ) => ( {
          ...c,
          ...( params.mix !== undefined ? {
            mix: String( params.mix ) as typeof c.mix
          } : {} ),
          ...( params.gapWeeks !== undefined ? {
            gapWeeks: Number( params.gapWeeks )
          } : {} )
        } ) );

        return answer( h );
      }
    },
    {
      id: "plan.propose",
      title: "Propose a post for a slot",
      description: "Pin a post to a free slot of the plan, with a line saying why — it shows in the gallery's Plan as «Pinned by Claude» for the person to open, replace or skip. Give ONE of: `sketch` (one sketch), `sketches` (a reel of 2 to 12 sketches cut together, e.g. the favourites of a series from sketches.list), or `recap` (\"2026-11\" for what was posted — else made — that month, \"2026\" for the year month by month). Refused for a slot that is not free, a sketch that does not exist or cannot play in a reel, one already pinned, or one posted within the gap. Proposes only: nothing is rendered, approved or sent.",
      params: {
        ...AT_PARAM,
        sketch: {
          type: "string",
          description: "\"engine/category/name\" from sketches.list",
          optional: true
        },
        sketches: {
          type: "strings",
          description: "A reel: 2 to 12 sketches, \"engine/category/name\" each, in order",
          optional: true
        },
        recap: {
          type: "string",
          description: "A month \"YYYY-MM\" or a year \"YYYY\" to recap",
          optional: true
        },
        title: {
          type: "string",
          description: "The reel's opening card and the post's title (a reel only); a default is written otherwise",
          optional: true
        },
        note: {
          type: "string",
          description: "Why this sketch here, for the person — one sentence, no invented number",
          optional: true
        }
      },
      async run( params ) {
        const {
          slot, reading
        } = await slotOrRefuse(
          h,
          params.at
        );
        const given = [
          params.sketch,
          params.sketches,
          params.recap
        ].filter( ( value ) => value !== undefined ).length;

        if ( given !== 1 ) {
          throw new CommandError(
            "invalid",
            "give exactly one of sketch, sketches or recap"
          );
        }

        const note = typeof params.note === "string" && params.note.trim() ? {
          note: params.note.trim()
        } : {};

        if ( params.sketch === undefined ) {
          const reel = params.recap !== undefined
            ? recapReel(
              reading,
              String( params.recap )
            )
            : chosenReel(
              reading,
              params.sketches,
              typeof params.title === "string" ? params.title : ""
            );

          pinSlot(
            slot.slot,
            {
              sketchKey: sketchKeyOf( REEL_HOST ),
              by: "agent",
              ...note,
              reel: {
                ...reel,
                ...( typeof params.title === "string" && params.title.trim() ? {
                  title: params.title.trim()
                } : {} )
              }
            }
          );

          return answer( h );
        }

        const target = String( params.sketch ).replace(
          /^\/+|\/+$/g,
          ""
        );
        const sketch = reading.catalogue.find( ( s ) => sketchPath( s ) === target );

        if ( !sketch ) {
          throw new CommandError(
            "invalid",
            `no sketch "${ target }" — sketches.list shows them`
          );
        }

        const key = sketchKeyOf( sketch );
        const other = reading.slots.find( ( s ) => s.slot !== slot.slot && s.proposal?.pin && s.proposal.sketchKey === key );

        if ( other ) {
          throw new CommandError(
            "invalid",
            `${ target } is already pinned on ${ other.slot } — plan.another there frees it`
          );
        }

        const gapWeeks = getChoices().gapWeeks;

        if ( tooSoon(
          reading.posted,
          key,
          slot.at.getTime(),
          gapWeeks
        ) ) {
          throw new CommandError(
            "invalid",
            `${ target } has a post within ${ gapWeeks } weeks of this slot — the person's rule (plan.set changes the gap, on their word)`
          );
        }

        pinSlot(
          slot.slot,
          {
            sketchKey: key,
            by: "agent",
            ...note
          }
        );

        return answer( h );
      }
    },
    {
      id: "plan.another",
      title: "Pass a proposal over",
      description: "The sketch proposed on this slot is passed over (it comes back in eight weeks) and the next one is proposed; a pin on the slot is taken back. Answers the plan afterwards.",
      params: AT_PARAM,
      async run( params ) {
        const {
          slot
        } = await slotOrRefuse(
          h,
          params.at
        );

        if ( !slot.proposal ) {
          throw new CommandError(
            "invalid",
            slot.skipped ? "this slot is skipped — plan.skip with on: false proposes for it again" : "nothing is proposed on this slot"
          );
        }

        passProposal(
          slot.proposal.key,
          slot.slot
        );

        return answer( h );
      }
    },
    {
      id: "plan.skip",
      title: "Leave a slot empty",
      description: "Nothing is proposed for this slot; `on: false` proposes for it again. Answers the plan afterwards.",
      params: {
        ...AT_PARAM,
        on: {
          type: "boolean",
          description: "false to propose for the slot again",
          optional: true
        }
      },
      async run( params ) {
        const {
          slot
        } = await slotOrRefuse(
          h,
          params.at
        );

        skipSlot(
          slot.slot,
          params.on !== false
        );

        return answer( h );
      }
    },
    {
      id: "plan.posted",
      title: "List what was posted",
      description: "The sketches already posted or still queued, newest first: what this browser sent and what the person's Postiz lists with a link to a sketch (another device's). Narrow to a month \"YYYY-MM\". Answers { posts: [{ sketch, title, at, day }], known } — `known` says what could not be read. A series or a recap leaves no trace here: it is posted from the empty sketch. Reads only; never a statistic.",
      params: {
        month: {
          type: "string",
          description: "Only this month, \"YYYY-MM\" in the rhythm's time zone",
          optional: true
        }
      },
      async run( params ) {
        const month = params.month === undefined ? null : String( params.month );

        if ( month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test( month ) ) {
          throw new CommandError(
            "invalid",
            `month "${ month }" is not a month — "2026-11"`
          );
        }

        const reading = await readPlan( h );
        const byKey = new Map( reading.catalogue.map( ( s ) => [
          sketchKeyOf( s ),
          s
        ] ) );

        return {
          posts: [
            ...reading.posted
          ].sort( (
            a, b
          ) => b.at - a.at ).map( ( post ) => {
            const sketch = byKey.get( post.sketchKey );

            return {
              sketch: sketch ? sketchPath( sketch ) : post.sketchKey,
              title: sketch ? sketchTitle(
                sketch.name,
                sketch.category
              ) : post.sketchKey,
              at: new Date( post.at ).toISOString(),
              day: localDay(
                new Date( post.at ),
                reading.timeZone
              ),
              ...( post.at > Date.now() ? {
                queued: true
              } : {} )
            };
          } )
            .filter( ( post ) => month === null || post.day.startsWith( month ) ),
          known: [
            reading.connected ? ( reading.calendarError ? `Postiz did not answer (${ reading.calendarError }): only this browser's sends are listed.` : "This browser's sends, and the posts of the person's Postiz whose caption links a sketch (five weeks back, eight ahead)." ) : "No Postiz is connected: only this browser's sends are listed."
          ].join( " " )
        };
      }
    },
    {
      id: "reel.build",
      title: "Build a reel of several sketches",
      description: "Cut several sketches together NOW, on the empty sketch: an opening card, then each sketch as a scene of one sequence (content.list shows it; content.update changes a scene, its length or its transition). Give `sketches` (2 to 12, in order), or `category` — every sketch of that series that can play, optionally only the person's favourites — at most 12, evenly sampled. For «take every favourite of this series and make me one piece». It opens the empty sketch and replaces its document: pass discard: true to leave this tab's unsaved changes behind. Nothing is planned, approved or sent.",
      params: {
        sketches: {
          type: "strings",
          description: "\"engine/category/name\" each, in order",
          optional: true
        },
        category: {
          type: "string",
          description: "A series, e.g. \"rings\" — every sketch of it that can play",
          optional: true
        },
        favorite: {
          type: "boolean",
          description: "With category: only the person's favourites",
          optional: true
        },
        title: {
          type: "string",
          description: "The opening card's words; the series' name otherwise",
          optional: true
        },
        subtitle: {
          type: "string",
          description: "The opening card's second line",
          optional: true
        },
        discard: {
          type: "boolean",
          description: "Leave this tab's unsaved changes behind",
          optional: true
        }
      },
      async run( params ) {
        const catalogue = h.navigation.catalogue() as PlanSketch[];

        if ( ( params.sketches === undefined ) === ( params.category === undefined ) ) {
          throw new CommandError(
            "invalid",
            "give sketches, or a category"
          );
        }

        let sketches: PlanSketch[];
        let name = "Selection";

        if ( params.category !== undefined ) {
          const category = String( params.category ).toLowerCase();
          const all = catalogue.filter( ( s ) => s.category === category );

          if ( !all.length ) {
            throw new CommandError(
              "invalid",
              `no series "${ category }" — sketches.list shows the categories in each id`
            );
          }

          sketches = all.filter( ( s ) => playable( s ) && ( !params.favorite || s.favorite ) ).sort( (
            a, b
          ) => ( a.createdAt ?? "" ).localeCompare( b.createdAt ?? "" ) || a.name.localeCompare(
            b.name,
            undefined,
            {
              numeric: true
            }
          ) );
          if ( sketches.length < 2 ) {
            throw new CommandError(
              "invalid",
              `${ sketches.length } ${ params.favorite ? "favourite " : "" }${ sketches.length === 1 ? "sketch" : "sketches" } of "${ category }" can play in a reel — it takes two`
            );
          }
          name = sketchTitle(
            category,
            null
          );
        } else {
          sketches = playableSketches(
            catalogue,
            params.sketches
          );
        }

        const even = sketches.length > PIN_REEL_MAX
          ? Array.from(
            {
              length: PIN_REEL_MAX
            },
            (
              _, i
            ) => sketches[ Math.round( i * ( sketches.length - 1 ) / ( PIN_REEL_MAX - 1 ) ) ]
          )
          : sketches;
        const title = typeof params.title === "string" && params.title.trim() ? params.title.trim() : name;
        const reel = reelOf(
          title.toUpperCase(),
          typeof params.subtitle === "string" ? params.subtitle.trim() : `${ even.length } ${ params.favorite ? "FAVOURITES" : "SKETCHES" }`,
          even,
          true
        );
        const document = reelDocument( {
          reel
        } )!;
        const host = sketchPath( REEL_HOST );
        const built = {
          sketch: host,
          title,
          reel: reel.scenes.map( ( scene ) => `p5/${ scene }` ),
          left: sketches.length - even.length,
          seconds: reelSeconds( reel.scenes.length )
        };

        if ( h.sketchId === host ) {
          const applied = h.gallery.importDocument( document );

          if ( !applied.ok ) {
            throw new CommandError(
              "failed",
              `the reel could not be built: ${ applied.reason }`
            );
          }
          // A reel cut on the spot belongs to no line of the plan: the host's own post.
          setCurrentReel( null );

          return {
            ...built,
            opened: false
          };
        }
        if ( h.history.canUndo() && !params.discard ) {
          throw new CommandError(
            "invalid",
            "this tab has changes that are not saved — building a reel opens the empty sketch and leaves them behind; pass discard: true to go anyway"
          );
        }
        if ( !h.gallery.stageImport( document ) ) {
          throw new CommandError(
            "failed",
            "the reel could not be handed over (this browser's storage is unavailable)"
          );
        }

        h.navigation.open( `/sketches/${ host }` );

        if ( !await until(
          () => h.navigation.currentSketch() === host,
          OPEN_TIMEOUT_MS
        ) ) {
          throw new CommandError(
            "failed",
            `${ host } did not finish loading within ${ OPEN_TIMEOUT_MS / 1000 } s — studio.status tells when it is ready`
          );
        }

        return {
          ...built,
          opened: true
        };
      }
    },
    {
      id: "plan.render",
      title: "Render and schedule what the person approved",
      description: "Run the Plan's render queue: every line the PERSON approved in the gallery's Plan (plan.get: state «approved») is rendered and SCHEDULED on its slot, one after another — the tab opens each sketch (or builds each reel), renders the variants its accounts take, checks the slot against Postiz again and sends through the same path as Export › Publish. Refused when nothing is approved: there is no command that approves a line, only the person's gesture. It never publishes now. It returns at once; plan.get's `run` and each slot's `state` say how it goes (a Reel takes minutes; the tab must stay open and visible). A line that fails says why and the next ones go on. An interrupted run is resumed by calling it again. Leaves this tab's unsaved changes behind only with discard: true.",
      params: {
        discard: {
          type: "boolean",
          description: "Leave this tab's unsaved changes behind",
          optional: true
        }
      },
      available: () => {
        if ( !h.publish.connection() ) {
          return "no Postiz is connected in this browser — the person connects one in Menu › Publishing";
        }

        const exportable = h.exports.supported();

        if ( exportable !== true ) {
          return exportable;
        }

        return runAlive(
          getRun(),
          Date.now()
        ) ? "the render queue is already running — plan.get shows where it is, plan.stop stops it" : true;
      },
      async run( params ) {
        const reading = await readPlan( h );
        const lines = reading.slots.filter( ( slot ) => slot.held && queueable( reading.status.get( slot.slot ) ?? "empty" ) );

        if ( !lines.length ) {
          throw new CommandError(
            "unavailable",
            "nothing is approved — the person approves lines in the gallery's Plan (Gallery › Plan › Approve). No command approves a line: propose (plan.propose), then ask them to read and approve"
          );
        }
        if ( h.history.canUndo() && !params.discard ) {
          throw new CommandError(
            "invalid",
            "this tab has changes that are not saved — the queue opens other sketches and leaves them behind; pass discard: true to go anyway"
          );
        }

        const current = getRun();
        const resumed = runInterrupted(
          current,
          Date.now()
        ) && current !== null;

        // The answer leaves before the tab starts moving from sketch to sketch.
        setTimeout(
          () => {
            if ( resumed ) {
              claimRun( current.id );
              updateRun(
                current.id,
                ( r ) => ( {
                  ...r,
                  beat: Date.now(),
                  phase: "resuming"
                } )
              );
            } else {
              startRun(
                lines.map( ( slot ) => slot.slot ),
                `/sketches/${ h.sketchId }`
              );
            }
          },
          50
        );

        return {
          started: !resumed,
          resumed,
          lines: lines.map( ( slot ) => ( {
            at: slot.slot,
            when: slotLabel(
              slot.at,
              reading.timeZone
            ),
            sketch: slot.proposal?.path,
            title: slot.proposal?.title
          } ) ),
          note: "The queue is running in this tab: it will open each sketch in turn. plan.get shows `run` and each line's state — planned, or failed with why."
        };
      }
    },
    {
      id: "plan.stop",
      title: "Stop the render queue",
      description: "Stop the Plan's render queue: the line being rendered is dropped and stays approved, the lines already scheduled stay scheduled (publish.unschedule or the gallery takes one back).",
      available: () => getRun()?.state === "running" ? true : "no render queue is running",
      run() {
        cancelRun();

        return {
          stopped: true,
          run: describeRun()
        };
      }
    },
    {
      id: "plan.reset",
      title: "Start the plan over",
      description: "Forget everything passed over, skipped and pinned; the mix and the gap stay. Only when the person asks: it also forgets THEIR skips.",
      run() {
        resetPlan();

        return answer( h );
      }
    },
    {
      id: "plan.open",
      title: "Open a proposal on Export › Publish",
      description: "Open the sketch proposed on this slot, on Export › Publish, with the slot as its When — the gallery's «Open in Publish». A series or a recap is BUILT first: the empty sketch receives a sequence of its sketches behind an opening card (content.list shows it, content.update changes a scene), with words to start from that are not approved. From there publish.status shows the post, publish.compose and publish.caption shape it, and publish.schedule sends it once the person approved the words (publish.approve, on their word only). Needs a connected Postiz. Leaves this tab's unsaved changes behind only with discard: true.",
      params: {
        ...AT_PARAM,
        discard: {
          type: "boolean",
          description: "Leave this tab's unsaved changes behind",
          optional: true
        }
      },
      available: () => h.publish.connection() ? true : "no Postiz is connected in this browser — the person connects one in Menu › Publishing",
      async run( params ) {
        const {
          slot
        } = await slotOrRefuse(
          h,
          params.at
        );
        const p = slot.proposal;

        if ( !p ) {
          throw new CommandError(
            "invalid",
            "nothing is proposed on this slot"
          );
        }

        const reel = reelDocument( p );
        const caption = reelCaption( p );

        if ( p.path === h.sketchId ) {
          if ( reel ) {
            const applied = h.gallery.importDocument( reel );

            if ( !applied.ok ) {
              throw new CommandError(
                "failed",
                `the reel could not be built: ${ applied.reason }`
              );
            }
            markOpened( p.key );
            setCurrentReel( p.key );
          }

          const postKey = postKeyOfProposal( p );

          patchDraft(
            postKey,
            {
              mode: "publish",
              // A reel's starting words, unless it already has some.
              ...( caption && getDraft( postKey ).caption === null ? {
                caption
              } : {} )
            }
          );
          setWhen(
            postKey,
            {
              kind: "at",
              at: slot.slot
            }
          );

          return {
            sketch: p.path,
            at: slot.slot,
            opened: false,
            note: "already open — its post is now on this slot (publish.status)"
          };
        }
        if ( h.history.canUndo() && !params.discard ) {
          throw new CommandError(
            "invalid",
            "this tab has changes that are not saved — opening another sketch leaves them behind; pass discard: true to go anyway"
          );
        }

        if ( reel ) {
          if ( !h.gallery.stageImport( reel ) ) {
            throw new CommandError(
              "failed",
              "the reel could not be handed over (this browser's storage is unavailable)"
            );
          }
          markOpened( p.key );
          stageReel( p.key );
        }
        askPlanned(
          p.sketchKey,
          slot.slot,
          caption
        );
        h.navigation.open( `/sketches/${ p.path }` );

        if ( !await until(
          () => h.navigation.currentSketch() === p.path,
          OPEN_TIMEOUT_MS
        ) ) {
          throw new CommandError(
            "failed",
            `${ p.path } did not finish loading within ${ OPEN_TIMEOUT_MS / 1000 } s — studio.status tells when it is ready`
          );
        }

        return {
          sketch: p.path,
          at: slot.slot,
          opened: true,
          note: "Export › Publish is open on this slot — publish.status shows the post"
        };
      }
    }
  ];
}
