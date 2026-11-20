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
  allPublications, patchDraft, setWhen
} from "../../postiz/publishStore";
import {
  recentPosts
} from "../../postiz/recentPosts";
import {
  askPlanned
} from "../../postiz/reopen";
import {
  GAP_WEEKS, MIXES, monthRecap, PIN_REEL_MAX, PLAN_WEEKS, playable, REEL_HOST, reelOf, sketchKeyOf, sketchPath, tooSoon, yearRecap, type Pin, type PlanSketch, type PlanSlot
} from "../../planner/planner";
import {
  sketchTitle
} from "../../postiz/caption";
import {
  localDay
} from "../../postiz/rhythm";
import {
  getChoices, markOpened, passProposal, pinSlot, resetPlan, skipSlot, updateChoices
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
import {
  askStage, stageBeat, withBreakdown
} from "../../planner/beatStage";
import {
  routeBeat
} from "../../planner/beatVariant";
import {
  beatOf, CAMPAIGN_WEEKS, planWithCampaigns, type LaidCampaign
} from "../../planner/campaign";
import {
  getCampaigns, markBeatOpened, passBeat
} from "../../planner/campaignStore";
import {
  acceptedCounts
} from "../../variations/kept";
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

export interface Reading {
  slots: PlanSlot[];
  /** The campaigns, every beat laid on the calendar (`campaign.ts`). */
  campaigns: LaidCampaign[];
  /** The free slots as far as a campaign reaches, and the instant the plan was read at. */
  farSlots: Date[];
  now: number;
  posted: Posted[];
  catalogue: PlanSketch[];
  /** False when no Postiz is kept: the default rhythm, and only this browser's sends. */
  connected: boolean;
  timeZone: string;
  rhythm: string;
  /** Why Postiz's calendar could not be read, when it could not. */
  calendarError: string | null;
}

export async function readPlan( h: StudioHandles ): Promise<Reading> {
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

  const farSlots = planFreeSlots(
    rhythm,
    posts ?? [],
    new Date( now ),
    CAMPAIGN_WEEKS
  );
  // The campaigns' beats are laid first; with none this is `planSlots` itself.
  const plan = planWithCampaigns(
    {
      catalogue,
      slots: planFreeSlots(
        rhythm,
        posts ?? [],
        new Date( now )
      ),
      farSlots,
      accepted: acceptedCounts( await h.gallery.store.entries() ),
      posted,
      choices: getChoices(),
      now,
      timeZone: rhythm.timeZone
    },
    getCampaigns()
  );

  return {
    catalogue,
    posted,
    connected: Boolean( conn ),
    timeZone: rhythm.timeZone,
    rhythm: rhythm.slots.map( slotHead ).join( " · " ),
    calendarError,
    farSlots,
    now,
    ...plan
  };
}

function describe(
  slot: PlanSlot, timeZone: string
) {
  const p = slot.proposal;
  const beat = beatOf( p );

  return {
    at: slot.slot,
    when: slotLabel(
      slot.at,
      timeZone
    ),
    state: slot.skipped ? "skipped" : !p ? "nothing left" : beat ? "a campaign's beat" : p.pin ? `pinned by ${ p.pin.by === "agent" ? "an agent" : "the person" }` : "proposed",
    ...( beat ? {
      campaign: {
        id: beat.id,
        beat: beat.beat,
        label: beat.label,
        of: `${ beat.index }/${ beat.total }`,
        ...( beat.needs ? {
          waitsFor: beat.needs
        } : {} )
      }
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
      reading.timeZone
    ) ),
    note: [
      reading.connected ? null : "No Postiz is connected in this browser: the default rhythm is drawn and only this browser's sends are known.",
      reading.calendarError ? `The person's Postiz did not answer (${ reading.calendarError }): taken slots are not known.` : null,
      "A proposal is not a post. plan.open puts one on Export › Publish; publish.approve stays the person's word."
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

export async function slotOrRefuse(
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

        const beat = beatOf( slot.proposal );

        // A campaign's beat is left out of its campaign; campaign.beat puts it back.
        if ( beat ) {
          passBeat(
            beat.id,
            beat.beat
          );
        } else {
          passProposal(
            slot.proposal.key,
            slot.slot
          );
        }

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

        // A campaign's beat stages its own document (`beatStage.ts`): the
        // variations' carousel, the breakdown, the series' reel, the words card.
        const beat = beatOf( p );
        const staged = beat
          ? stageBeat(
            p,
            beat,
            await h.gallery.store.entries()
          )
          : null;

        if ( staged && !staged.ok ) {
          throw new CommandError(
            "unavailable",
            `${ p.title } cannot be opened yet. ${ staged.reason } (variations.list, campaign.get).`
          );
        }

        const reel = staged?.ok ? staged.staged.document : reelDocument( p );
        const caption = staged?.ok ? staged.staged.caption : reelCaption( p );
        const stage = staged?.ok ? staged.staged.stage : null;
        const opened = () => beat
          ? markBeatOpened(
            beat.id,
            beat.beat,
            slot.slot
          )
          : reel ? markOpened( p.key ) : undefined;

        if ( beat ) {
          patchDraft(
            p.sketchKey,
            {
              trial: beat.trial
            }
          );
          // The variations go out as a carousel; any other beat of the sketch as it usually does.
          if ( beat.kind === "sketch" || beat.kind === "variations" || beat.kind === "process" ) {
            routeBeat(
              p.sketchKey,
              Array.isArray( reel?.slides ) && reel.slides.length > 1,
              h.publish.connection()?.channels?.map( ( channel ) => channel.id ) ?? []
            );
          }
        }

        if ( p.path === h.sketchId ) {
          if ( reel ) {
            const applied = h.gallery.importDocument( reel );

            if ( !applied.ok ) {
              throw new CommandError(
                "failed",
                `the ${ beat ? "piece" : "reel" } could not be built: ${ applied.reason }`
              );
            }
          }
          if ( stage ) {
            const content = withBreakdown(
              h.getValues( "content" ),
              ( seed ) => h.makeItem(
                "breakdown",
                seed
              )
            );

            if ( content ) {
              h.setValue(
                "content",
                content
              );
            }
          }
          opened();
          patchDraft(
            p.sketchKey,
            {
              mode: "publish",
              ...( caption ? {
                caption
              } : {} )
            }
          );
          setWhen(
            p.sketchKey,
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

        if ( reel && !h.gallery.stageImport( reel ) ) {
          throw new CommandError(
            "failed",
            "the piece could not be handed over (this browser's storage is unavailable)"
          );
        }
        if ( stage ) {
          askStage(
            p.sketchKey,
            stage
          );
        }
        opened();
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
