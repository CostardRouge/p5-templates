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
  GAP_WEEKS, MIXES, PLAN_WEEKS, planSlots, sketchKeyOf, sketchPath, tooSoon, type PlanSketch, type PlanSlot
} from "../../planner/planner";
import {
  getChoices, passProposal, pinSlot, resetPlan, skipSlot, updateChoices
} from "../../planner/planStore";
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

  return {
    catalogue,
    posted,
    connected: Boolean( conn ),
    timeZone: rhythm.timeZone,
    rhythm: rhythm.slots.map( slotHead ).join( " · " ),
    calendarError,
    slots: planSlots( {
      catalogue,
      slots: planFreeSlots(
        rhythm,
        posts ?? [],
        new Date( now )
      ),
      posted,
      choices: getChoices(),
      now
    } )
  };
}

function describe(
  slot: PlanSlot, timeZone: string
) {
  const p = slot.proposal;

  return {
    at: slot.slot,
    when: slotLabel(
      slot.at,
      timeZone
    ),
    state: slot.skipped ? "skipped" : !p ? "nothing left" : p.pin ? `pinned by ${ p.pin.by === "agent" ? "an agent" : "the person" }` : "proposed",
    ...( p ? {
      sketch: p.path,
      title: p.title,
      pillar: p.pillar,
      favorite: p.favorite,
      why: p.why,
      key: p.key
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
      description: "What to post next: one line per FREE slot of the person's rhythm over the next five weeks, each with the sketch proposed for it — a new sketch in the order of its series, or a favourite not posted recently — and why. The same plan as the gallery's Plan view. Answers { rhythm, mix, gapWeeks, slots: [{ at, when, state, sketch, title, pillar, why, key }] }. It reads the calendar; it sends nothing.",
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
      title: "Propose a sketch for a slot",
      description: "Pin a sketch to a free slot of the plan, with a line saying why — it shows in the gallery's Plan as «Pinned by Claude» for the person to open, replace or skip. Refused for a slot that is not free, a sketch that does not exist, one already in the plan, or one posted within the gap. Proposes only: nothing is rendered, approved or sent.",
      params: {
        ...AT_PARAM,
        sketch: {
          type: "string",
          description: "\"engine/category/name\" from sketches.list"
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
            ...( typeof params.note === "string" && params.note.trim() ? {
              note: params.note.trim()
            } : {} )
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
      description: "Open the sketch proposed on this slot, on Export › Publish, with the slot as its When — the gallery's «Open in Publish». From there publish.status shows the post, publish.compose and publish.caption shape it, and publish.schedule sends it once the person approved the words (publish.approve, on their word only). Needs a connected Postiz. Leaves this tab's unsaved changes behind only with discard: true.",
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

        if ( p.path === h.sketchId ) {
          patchDraft(
            p.sketchKey,
            {
              mode: "publish"
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

        askPlanned(
          p.sketchKey,
          slot.slot
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
