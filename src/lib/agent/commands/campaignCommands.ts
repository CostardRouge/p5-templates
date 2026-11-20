/**
 * Campaigns from the tab (lab 9, `docs/memory/publishing.md`): the posts one
 * sketch gets over the weeks, read and proposed by an agent — the same model
 * (`src/lib/planner/campaign.ts`) and the same store as the gallery's Plan,
 * so a campaign an agent creates shows there, marked as Claude's, for the
 * person to keep or drop.
 *
 * An agent PROPOSES. A campaign only lays proposals on the plan: each beat is
 * a line the person opens on Export › Publish, and nothing here approves
 * words or sends anything. There is no `campaign.approve`, nor will there be.
 */
import {
  CommandError, type CommandSpec
} from "../../../../scripts/mcp/registry.ts";
import {
  withBreakdown
} from "../../planner/beatStage";
import {
  beatOf, beatProblem, blockedSlots, CAMPAIGN_TEMPLATES, CAMPAIGN_WEEK_CAP, liveCampaignOf, makeCampaign, previewCampaign, TEMPLATES, templatesFor, type Campaign, type CampaignTemplate, type LaidCampaign
} from "../../planner/campaign";
import {
  addCampaign, dropCampaign, getCampaigns, passBeat
} from "../../planner/campaignStore";
import {
  sketchKeyOf, sketchPath, type PlanSketch
} from "../../planner/planner";
import {
  getChoices, pinSlot
} from "../../planner/planStore";
import {
  slotLabel
} from "../../postiz/rhythm";
import {
  acceptedCounts
} from "../../variations/kept";
import type {
  StudioHandles
} from "../handles";
import {
  readPlan, slotOrRefuse, type Reading
} from "./planCommands";

function describeCampaign(
  laid: LaidCampaign, timeZone: string
) {
  const {
    campaign
  } = laid;

  return {
    id: campaign.id,
    sketch: laid.sketch ? sketchPath( laid.sketch ) : campaign.sketchKey,
    title: laid.title,
    template: campaign.template,
    by: campaign.by === "agent" ? "an agent" : "the person",
    live: laid.live,
    beats: laid.beats.map( ( beat ) => ( {
      beat: beat.spec.id,
      label: beat.spec.label,
      what: beat.spec.what,
      day: beat.spec.offset ? `release + ${ beat.spec.offset } days` : "day 0",
      state: beat.state === "unplaced" ? "no free slot in the calendar read so far" : beat.state === "off" ? "left out" : beat.state,
      ...( beat.at !== null
        ? {
          at: new Date( beat.at ).toISOString(),
          when: slotLabel(
            new Date( beat.at ),
            timeZone
          )
        }
        : {} ),
      ...( beat.needs ? {
        waitsFor: beat.needs
      } : {} ),
      ...( beat.opened ? {
        opened: true
      } : {} )
    } ) )
  };
}

function templateOrRefuse(
  value: unknown, sketch: PlanSketch, catalogue: readonly PlanSketch[]
): CampaignTemplate {
  const offered = templatesFor(
    sketch,
    catalogue
  );

  if ( value === undefined ) {
    return offered[ 0 ];
  }
  if ( !offered.includes( value as CampaignTemplate ) ) {
    throw new CommandError(
      "invalid",
      `the "${ String( value ) }" campaign is not offered for ${ sketchPath( sketch ) } — ${ offered.join( ", " ) } (a comeback is for a favourite, a finale for the last sketch of a series of three or more that can play as a reel)`
    );
  }

  return value as CampaignTemplate;
}

/** The slot, the sketch and the draft campaign a preview or a creation is about — or the refusal. */
async function draftOrRefuse(
  h: StudioHandles, params: Record<string, unknown>
): Promise<{ reading: Reading;
  draft: Campaign;
  sketch: PlanSketch;
  slot: string;
  pinned: boolean; }> {
  const {
    slot, reading
  } = await slotOrRefuse(
    h,
    params.at
  );
  const p = slot.proposal;

  if ( slot.skipped ) {
    throw new CommandError(
      "invalid",
      "this slot is skipped — plan.skip with on: false proposes for it again"
    );
  }
  if ( beatOf( p ) ) {
    throw new CommandError(
      "invalid",
      `this slot already holds a campaign's beat (${ p!.title }) — campaign.get lists the campaigns`
    );
  }

  let sketch: PlanSketch | undefined;

  if ( params.sketch !== undefined ) {
    const target = String( params.sketch ).replace(
      /^\/+|\/+$/g,
      ""
    );

    sketch = reading.catalogue.find( ( s ) => sketchPath( s ) === target );
    if ( !sketch || sketch.hiddenFromGallery ) {
      throw new CommandError(
        "invalid",
        `no sketch "${ target }" — sketches.list shows them`
      );
    }
    if ( p?.pin && p.sketchKey !== sketchKeyOf( sketch ) ) {
      throw new CommandError(
        "invalid",
        `this slot is pinned to ${ p.path } — plan.another there frees it`
      );
    }
  } else {
    if ( !p || p.reel ) {
      throw new CommandError(
        "invalid",
        p ? "this slot proposes a reel of several sketches — a campaign is one sketch's; give `sketch`, or pick a slot that proposes one" : "nothing is proposed on this slot — give `sketch`"
      );
    }
    sketch = reading.catalogue.find( ( s ) => sketchKeyOf( s ) === p.sketchKey );
    if ( !sketch ) {
      throw new CommandError(
        "invalid",
        `${ p.path } is no longer in the catalogue`
      );
    }
  }

  const running = liveCampaignOf(
    reading.campaigns,
    sketchKeyOf( sketch )
  );

  if ( running ) {
    throw new CommandError(
      "invalid",
      `${ sketchPath( sketch ) } already has a campaign running (${ running.campaign.id }) — campaign.drop it first, on the person's word`
    );
  }

  const template = templateOrRefuse(
    params.template,
    sketch,
    reading.catalogue
  );
  const beats = TEMPLATES[ template ].beats;
  const off = Array.isArray( params.without ) ? params.without.map( String ) : [];

  for ( const id of off ) {
    if ( !beats.some( ( spec ) => spec.id === id ) ) {
      throw new CommandError(
        "invalid",
        `the ${ template } campaign has no beat "${ id }" — ${ beats.map( ( spec ) => spec.id ).join( ", " ) }`
      );
    }
  }

  const draft = makeCampaign(
    sketch,
    reading.catalogue,
    template,
    slot.slot,
    Date.now(),
    "agent",
    off
  );

  if ( draft.off.length >= beats.length ) {
    throw new CommandError(
      "invalid",
      "every beat is left out — a campaign needs at least one"
    );
  }

  return {
    reading,
    draft,
    sketch,
    slot: slot.slot,
    pinned: Boolean( p?.pin )
  };
}

async function preview(
  h: StudioHandles, reading: Reading, draft: Campaign, sketch: PlanSketch
) {
  const laid = previewCampaign(
    {
      campaigns: getCampaigns(),
      slots: reading.farSlots,
      posted: reading.posted,
      // The slot it starts on may wear a pin the campaign replaces.
      blocked: blockedSlots(
        {
          catalogue: reading.catalogue,
          slots: reading.slots.map( ( slot ) => slot.at ),
          posted: reading.posted,
          choices: getChoices(),
          now: reading.now,
          timeZone: reading.timeZone
        },
        draft.start
      ),
      catalogue: reading.catalogue,
      accepted: acceptedCounts( await h.gallery.store.entries() ),
      now: reading.now,
      timeZone: reading.timeZone
    },
    draft
  );

  return {
    ...describeCampaign(
      laid,
      reading.timeZone
    ),
    leftOut: TEMPLATES[ draft.template ].beats.filter( ( spec ) => draft.off.includes( spec.id ) ).map( ( spec ) => ( {
      beat: spec.id,
      why: beatProblem(
        spec,
        sketch,
        reading.catalogue
      ) ?? "left out on request"
    } ) )
  };
}

const DRAFT_PARAMS = {
  at: {
    type: "string" as const,
    description: "The slot of plan.get the campaign starts on (day 0), as its `at`"
  },
  sketch: {
    type: "string" as const,
    description: "\"engine/category/name\" from sketches.list; default: the sketch proposed on that slot",
    optional: true
  },
  template: {
    type: "string" as const,
    description: "drop: release, variations (+3 days), how it's made (+7), comeback (+56). comeback, for a favourite: comeback, one variation (+4), how it's made (+10). finale, for the last sketch of a series: release, the series as one reel (+2), the person's words (+7), the reel again (+56). Default: comeback for a favourite, drop otherwise",
    enum: CAMPAIGN_TEMPLATES,
    optional: true
  },
  without: {
    type: "strings" as const,
    description: "Beats to leave out, by id (release, variations, process, series, words, comeback)",
    optional: true
  }
};

export function campaignCommands( h: StudioHandles ): CommandSpec[] {
  return [
    {
      id: "campaign.get",
      title: "Read the campaigns",
      description: "The campaigns in this browser: for each, its sketch, its template, who asked for it, and every beat — what the post is, where it lands on the rhythm (the first free slot on or after its day, two of one campaign a week at most), its state (proposed, queued, posted, left out) and what it still waits for (accepted variations, the person's words). A beat that is proposed is a line of plan.get wearing `campaign`; plan.open opens it. Reads only.",
      async run() {
        const reading = await readPlan( h );

        return {
          campaigns: reading.campaigns.map( ( laid ) => describeCampaign(
            laid,
            reading.timeZone
          ) ),
          weekCap: CAMPAIGN_WEEK_CAP,
          note: reading.campaigns.length
            ? "A beat is a proposal: the person opens it on Export › Publish (plan.open), and publish.approve stays their word."
            : "No campaign yet. campaign.preview shows what one would lay on the calendar; campaign.create proposes it."
        };
      }
    },
    {
      id: "campaign.preview",
      title: "Preview a campaign",
      description: "What a campaign for a sketch WOULD lay on the calendar, starting on a slot of plan.get: each beat with its date, and the beats left out because the sketch cannot carry them (with why). Nothing is kept. Show this to the person before campaign.create.",
      params: DRAFT_PARAMS,
      async run( params ) {
        const {
          reading, draft, sketch
        } = await draftOrRefuse(
          h,
          params
        );

        return {
          ...await preview(
            h,
            reading,
            draft,
            sketch
          ),
          offered: templatesFor(
            sketch,
            reading.catalogue
          ),
          kept: false
        };
      }
    },
    {
      id: "campaign.create",
      title: "Propose a campaign for a sketch",
      description: "Create the campaign of a sketch, starting on a slot of plan.get: its beats become lines of the Plan wearing the campaign's tag («by Claude»), each on the first free slot on or after its day. It PROPOSES only: nothing is rendered, approved or sent, every beat waits for the person to open it, and they can drop the whole campaign in one click. Refused for a sketch that already has a campaign running, a template the sketch does not fit, a slot that is not free. Do it when the person asked for a campaign — a new sketch never starts one by itself.",
      params: DRAFT_PARAMS,
      async run( params ) {
        const {
          reading, draft, sketch, slot, pinned
        } = await draftOrRefuse(
          h,
          params
        );
        const answer = await preview(
          h,
          reading,
          draft,
          sketch
        );

        // The release takes the place of a pin on its slot.
        if ( pinned ) {
          pinSlot(
            slot,
            null
          );
        }
        addCampaign( draft );

        return {
          ...answer,
          kept: true,
          note: "The beats are now lines of the Plan (plan.get). The Variations beat waits for accepted pieces: variations.propose, variations.sheet and variations.keep propose them, the person accepts."
        };
      }
    },
    {
      id: "campaign.beat",
      title: "Leave a beat out, or put it back",
      description: "Leave one beat out of a campaign (its slot goes back to the plan), or put it back with on: true. plan.another on a beat's slot does the first.",
      params: {
        id: {
          type: "string",
          description: "A campaign id from campaign.get"
        },
        beat: {
          type: "string",
          description: "The beat's id (release, variations, process, series, words, comeback)"
        },
        on: {
          type: "boolean",
          description: "true puts the beat back (default: leave it out)",
          optional: true
        }
      },
      run( params ) {
        const campaign = getCampaigns().find( ( c ) => c.id === params.id );

        if ( !campaign ) {
          throw new CommandError(
            "invalid",
            `no campaign "${ String( params.id ) }" — campaign.get lists them`
          );
        }

        const beats = TEMPLATES[ campaign.template ].beats.map( ( spec ) => spec.id );

        if ( !beats.includes( String( params.beat ) ) ) {
          throw new CommandError(
            "invalid",
            `the ${ campaign.template } campaign has no beat "${ String( params.beat ) }" — ${ beats.join( ", " ) }`
          );
        }

        passBeat(
          campaign.id,
          String( params.beat ),
          params.on !== true
        );

        return {
          id: campaign.id,
          beat: String( params.beat ),
          on: params.on === true
        };
      }
    },
    {
      id: "campaign.drop",
      title: "Drop a campaign",
      description: "Forget a campaign: its lines leave the Plan and its sketch goes back to the plan's own pillars. Posts already sent or queued are not touched (publish.unschedule takes one back). Only when the person asks, or to take back a campaign YOU created in this conversation.",
      params: {
        id: {
          type: "string",
          description: "A campaign id from campaign.get"
        }
      },
      run( params ) {
        const campaign = getCampaigns().find( ( c ) => c.id === params.id );

        if ( !campaign ) {
          throw new CommandError(
            "invalid",
            `no campaign "${ String( params.id ) }" — campaign.get lists them`
          );
        }

        dropCampaign( campaign.id );

        return {
          id: campaign.id,
          dropped: true,
          remaining: getCampaigns().length
        };
      }
    },
    {
      id: "process.build",
      title: "Show how the sketch is made",
      description: "Stage «how it's made» NOW on the open sketch: a breakdown item is added to its content, so the loop plays with its dials showing — every parameter group settles in turn from the far end of its range to the value the piece uses, named and gauged in a block that roams the corners. content.list shows the item; content.update changes it (`build.selection` \"changed\" narrates only what differs from the stock sketch, `build.excludeKeys` leaves groups out, `valueStyle`, `placement`). studio.contactSheet shows the loop. Refused when the piece already plays a breakdown. Nothing is planned, approved or sent.",
      available: () => h.engineId === "p5" ? true : "the breakdown is drawn by p5 sketches only",
      run() {
        const content = withBreakdown(
          h.getValues( "content" ),
          ( seed ) => h.makeItem(
            "breakdown",
            seed
          )
        );

        if ( !content ) {
          throw new CommandError(
            "invalid",
            "this piece already plays a breakdown — content.list shows it, content.update changes it"
          );
        }

        h.setValue(
          "content",
          content
        );

        return {
          sketch: h.sketchId,
          path: `content.${ content.length - 1 }`,
          note: "The loop now narrates its own parameters. studio.contactSheet shows it; export.* renders it."
        };
      }
    }
  ];
}
