/**
 * A CAMPAIGN (lab 9, `docs/memory/publishing.md`): the posts one sketch gets
 * over the weeks — its release, then what prolongs it. A campaign is a list
 * of BEATS counted in days from the release; each beat lands on the first
 * free slot of the rhythm on or after its day, at most two of one campaign in
 * a week, and becomes an ordinary line of the Plan wearing a tag, opened,
 * passed or skipped like any other. There is no campaign screen.
 *
 * Nothing here schedules: a beat is a proposal until the person opens it on
 * Export › Publish. A campaign is created on the person's word (or proposed
 * by an agent and marked so), never by itself.
 *
 * Pure and DOM-free, like `planner.ts`, which it wraps without changing: the
 * beats enter the plan as pins computed on every read, so the same campaigns,
 * the same calendar and the same choices always give the same plan.
 */

import {
  addDays
} from "../gallery/calendar";
import {
  sketchTitle
} from "../postiz/caption";
import {
  localDay, weekOf
} from "../postiz/rhythm";
import {
  planSlots, playable, REEL_HOST, REEL_MIN, rendezvous, seriesPool, sketchKeyOf, versionOf, type Pin, type PlanInput, type PlanSketch, type PlanSlot, type Proposal
} from "./planner";

/** Which list of beats a campaign follows. */
export type CampaignTemplate = "drop" | "comeback" | "finale";

/**
 * What a beat opens: the sketch as it is, a carousel of kept variations, the
 * sketch with its breakdown playing, the series as one reel, a card of words.
 */
export type BeatKind = "sketch" | "variations" | "process" | "series" | "words";

export interface BeatSpec {
  /** Unique in its template; what a campaign's `off` and `opened` name. */
  id: string;
  kind: BeatKind;
  label: string;
  /** What the post is, for the person. */
  what: string;
  /** Days after the release. */
  offset: number;
  /** A variations beat: how many accepted pieces it takes, and at most. */
  pieces?: { min: number;
    max: number };
  /** Meant as a Trial Reel on Instagram (the person ticks it in Publish). */
  trial?: boolean;
}

export const TEMPLATES: Record<CampaignTemplate, { label: string;
  title: string;
  beats: BeatSpec[]; }> = {
  drop: {
    label: "Release",
    title: "A new sketch: its release, its variations, how it is made, and a comeback eight weeks later",
    beats: [
      {
        id: "release",
        kind: "sketch",
        label: "Release",
        what: "The loop itself: a Reel and a Story on Instagram, the video on TikTok and YouTube, a picture on X, Threads and Bluesky",
        offset: 0
      },
      {
        id: "variations",
        kind: "variations",
        label: "Variations",
        what: "A carousel: the same sketch with 3 to 5 other settings, from pieces you accepted",
        offset: 3,
        pieces: {
          min: 3,
          max: 5
        }
      },
      {
        id: "process",
        kind: "process",
        label: "How it's made",
        what: "The loop with its dials showing: each parameter settles in turn",
        offset: 7
      },
      {
        id: "comeback",
        kind: "sketch",
        label: "Comeback",
        what: "The same loop again, as a Trial Reel",
        offset: 56,
        trial: true
      }
    ]
  },
  comeback: {
    label: "Favourite comeback",
    title: "A favourite brought back: the loop, one other look of it, how it is made",
    beats: [
      {
        id: "release",
        kind: "sketch",
        label: "Comeback",
        what: "The favourite again, as a Trial Reel and a Story",
        offset: 0,
        trial: true
      },
      {
        id: "variations",
        kind: "variations",
        label: "Variation",
        what: "One other look of it, from a piece you accepted",
        offset: 4,
        pieces: {
          min: 1,
          max: 1
        }
      },
      {
        id: "process",
        kind: "process",
        label: "How it's made",
        what: "The loop with its dials showing: each parameter settles in turn",
        offset: 10
      }
    ]
  },
  finale: {
    label: "Series finale",
    title: "The last sketch of a series: its release, the whole series as one Reel, your words, and the reel again eight weeks later",
    beats: [
      {
        id: "release",
        kind: "sketch",
        label: "Release",
        what: "The last sketch of the series: a Reel and a Story, stills elsewhere",
        offset: 0
      },
      {
        id: "series",
        kind: "series",
        label: "Series reel",
        what: "Every sketch of the series cut into one Reel",
        offset: 2
      },
      {
        id: "words",
        kind: "words",
        label: "Words",
        what: "A card of text: what the series taught you — your words, never written for you",
        offset: 7
      },
      {
        id: "comeback",
        kind: "series",
        label: "Comeback",
        what: "The series reel again, as a Trial Reel",
        offset: 56,
        trial: true
      }
    ]
  }
};

export const CAMPAIGN_TEMPLATES = Object.keys( TEMPLATES ) as CampaignTemplate[];

/** At most this many beats of ONE campaign in a week (his answer to lab 9's Q3). */
export const CAMPAIGN_WEEK_CAP = 2;
/** How far the beats are laid: the latest beat is 56 days after a release that may itself be five weeks ahead. */
export const CAMPAIGN_WEEKS = 14;
/** A campaign is forgotten this long after its day 0. */
export const CAMPAIGN_DAYS = 180;

const HOST_KEY = sketchKeyOf( REEL_HOST );

export interface Campaign {
  id: string;
  /** `<engine>/<name>`. */
  sketchKey: string;
  template: CampaignTemplate;
  /** Day 0: the instant of the slot it was created on, ISO. */
  start: string;
  createdAt: number;
  /** Who asked for it: the person in the Plan, or an agent (shown, so it can be dropped). */
  by: "person" | "agent";
  /** Beats left out — unticked when it was created, or passed over since. */
  off: string[];
  /** Beats opened on Export › Publish: when, and on which slot. Opened is not posted. */
  opened: Record<string, { at: number;
    slot: string; }>;
}

export type BeatState =
  /** On a free slot of the rhythm, waiting to be opened. */
  | "proposed"
  /** A post of it is in the queue. */
  | "queued"
  /** A post of it went out. */
  | "posted"
  /** Left out of the campaign. */
  | "off"
  /** No free slot in the calendar read so far. */
  | "unplaced";

export interface LaidBeat {
  spec: BeatSpec;
  state: BeatState;
  /** Its place among the beats that are on, from 1; 0 when off. */
  index: number;
  /** Where it lands or landed (ms); null when off or unplaced. */
  at: number | null;
  /** The free slot it sits on, ISO; null unless `proposed`. */
  slot: string | null;
  /** What it waits for before it can be opened, in words; null when ready. */
  needs: string | null;
  /** True when it was opened on Export › Publish and no post of it is known yet. */
  opened: boolean;
}

export interface LaidCampaign {
  campaign: Campaign;
  /** The sketch's catalogue entry; null when it left the catalogue. */
  sketch: PlanSketch | null;
  /** `Materials · Smoke`. */
  title: string;
  /** `Smoke` — what the tag on a line says. */
  name: string;
  beats: LaidBeat[];
  /** How many beats are on. */
  total: number;
  /** False once every beat that is on went out: nothing is left to propose. */
  live: boolean;
}

/** The tag a campaign's line wears in the Plan, carried on its proposal. */
export interface BeatTag {
  /** The campaign's id and its beat's. */
  id: string;
  beat: string;
  kind: BeatKind;
  label: string;
  what: string;
  /** The campaign's own sketch, `<engine>/<name>` — a reel's or the words' proposal names the host. */
  sketchKey: string;
  /** Its series as a person names it (`Materials`); the sketch's title when it has none. */
  series: string;
  /** `Smoke`, and `2` of `4`. */
  name: string;
  index: number;
  total: number;
  by: Campaign[ "by" ];
  needs: string | null;
  trial: boolean;
  opened: boolean;
  /** A variations beat: how many accepted pieces it takes, and at most. */
  pieces?: BeatSpec[ "pieces" ];
}

export type BeatProposal = Proposal & { campaign: BeatTag };

/** The campaign tag of a Plan line, or null for an ordinary proposal. */
export function beatOf( proposal: Proposal | null | undefined ): BeatTag | null {
  return ( proposal as Partial<BeatProposal> | null | undefined )?.campaign ?? null;
}

export function beatKey(
  campaignId: string, beat: string
): string {
  return `campaign:${ campaignId }:${ beat }`;
}

/** `Materials · Smoke` → `Smoke`; a title of one part stays whole. */
export function shortName( title: string ): string {
  return title.split( " · " ).slice( 1 )
    .join( " · " ) || title;
}

/** The sketches of `sketch`'s series that can play in a reel, in the series' order. */
function seriesOf(
  sketch: PlanSketch, catalogue: readonly PlanSketch[]
): PlanSketch[] {
  if ( !sketch.category ) {
    return [];
  }

  return catalogue.filter( ( s ) => s.engine === sketch.engine && s.category === sketch.category && playable( s ) )
    .sort( (
      a, b
    ) => versionOf( a.name ) - versionOf( b.name ) || ( a.createdAt ?? "" ).localeCompare( b.createdAt ?? "" ) || a.name.localeCompare( b.name ) );
}

/**
 * Why `sketch` cannot carry this beat, or null when it can — a beat a sketch
 * cannot carry is left unticked and says why (lab 9: Postel).
 */
export function beatProblem(
  spec: BeatSpec, sketch: PlanSketch, catalogue: readonly PlanSketch[]
): string | null {
  if ( spec.kind === "process" && sketch.engine !== REEL_HOST.engine ) {
    return "The breakdown that shows the dials is drawn by p5 sketches only";
  }
  if ( spec.kind === "series" || spec.kind === "words" ) {
    const series = seriesOf(
      sketch,
      catalogue
    );

    if ( series.length < REEL_MIN ) {
      return `Its series has ${ series.length } ${ series.length === 1 ? "sketch" : "sketches" } that can play in a reel — a series takes ${ REEL_MIN }`;
    }
  }

  return null;
}

/**
 * The templates offered for a sketch, the one to start from first: a
 * favourite comes back, anything else is released; the finale is offered for
 * the last sketch of a series that can play as a reel.
 */
export function templatesFor(
  sketch: PlanSketch, catalogue: readonly PlanSketch[]
): CampaignTemplate[] {
  const series = seriesOf(
    sketch,
    catalogue
  );
  const last = series.length >= REEL_MIN && series[ series.length - 1 ].name === sketch.name;
  const out: CampaignTemplate[] = sketch.favorite
    ? [
      "comeback",
      "drop"
    ]
    : [
      "drop"
    ];

  return last
    ? [
      ...out,
      "finale"
    ]
    : out;
}

/** A campaign for `sketch` from the slot `start`, every beat it can carry ticked unless `off` says otherwise. */
export function makeCampaign(
  sketch: PlanSketch, catalogue: readonly PlanSketch[], template: CampaignTemplate, start: string, now: number, by: Campaign[ "by" ] = "person", off: readonly string[] = []
): Campaign {
  const beats = TEMPLATES[ template ].beats;

  return {
    id: `${ sketch.name }-${ now.toString( 36 ) }`,
    sketchKey: sketchKeyOf( sketch ),
    template,
    start: new Date( start ).toISOString(),
    createdAt: now,
    by,
    off: beats.filter( ( spec ) => off.includes( spec.id ) || beatProblem(
      spec,
      sketch,
      catalogue
    ) ).map( ( spec ) => spec.id ),
    opened: {}
  };
}

export interface LayInput {
  campaigns: readonly Campaign[];
  /** The rhythm's free slots, `CAMPAIGN_WEEKS` ahead, any order. */
  slots: readonly Date[];
  /** Every known send of a sketch: `<engine>/<name>` and when (ms). */
  posted: readonly { sketchKey: string;
    at: number }[];
  /** Slots a beat may not take (skipped, pinned by hand, held by a recap), ISO. */
  blocked?: ReadonlySet<string>;
  catalogue: readonly PlanSketch[];
  /** How many variations of each sketch (`<engine>/<name>`) the person accepted. */
  accepted?: Readonly<Record<string, number>>;
  now: number;
  timeZone?: string;
  /** Beats of one campaign in a week, at most (`CAMPAIGN_WEEK_CAP`). */
  weekCap?: number;
}

function needsOf(
  spec: BeatSpec, accepted: number
): string | null {
  if ( spec.kind === "variations" && spec.pieces && accepted < spec.pieces.min ) {
    const min = spec.pieces.min;

    return `${ min } accepted ${ min === 1 ? "variation" : "variations" } — ${ accepted } so far`;
  }
  if ( spec.kind === "words" ) {
    return "your words on the card";
  }

  return null;
}

/**
 * Where every beat of every campaign lands. In the order the campaigns were
 * made, each beat in turn: a known post of it keeps its place (queued or
 * posted); otherwise it takes the first free slot on or after its day that
 * no other beat holds, after the beat before it, within the week's cap. The
 * days are counted from where the FIRST beat really lands, so a release
 * moved to Friday moves what follows.
 */
export function layCampaigns( input: LayInput ): LaidCampaign[] {
  const tz = input.timeZone ?? "UTC";
  const byKey = new Map( input.catalogue.map( ( s ) => [
    sketchKeyOf( s ),
    s
  ] ) );
  const slots = [
    ...input.slots
  ].filter( ( at ) => at.getTime() > input.now ).sort( (
    a, b
  ) => a.getTime() - b.getTime() );
  const posts = [
    ...input.posted
  ].sort( (
    a, b
  ) => a.at - b.at );
  const claimed = new Set<number>();
  const taken = new Set<string>( input.blocked ?? [] );
  const dayOf = ( at: number ) => localDay(
    new Date( at ),
    tz
  );

  return [
    ...input.campaigns
  ].sort( (
    a, b
  ) => a.createdAt - b.createdAt || a.id.localeCompare( b.id ) ).map( ( campaign ) => {
    const sketch = byKey.get( campaign.sketchKey ) ?? null;
    const title = sketch
      ? sketchTitle(
        sketch.name,
        sketch.category
      )
      : campaign.sketchKey;
    const specs = TEMPLATES[ campaign.template ].beats;
    const on = specs.filter( ( spec ) => !campaign.off.includes( spec.id ) );
    const perWeek = new Map<string, number>();
    const count = ( at: number ) => {
      const week = weekOf(
        new Date( at ),
        tz
      );

      perWeek.set(
        week,
        ( perWeek.get( week ) ?? 0 ) + 1
      );
    };
    const hostBeat = ( spec: BeatSpec ) => spec.kind === "series" || spec.kind === "words";
    const keyOf = ( spec: BeatSpec ) => hostBeat( spec ) ? HOST_KEY : campaign.sketchKey;

    // A beat opened from the Plan owns the post made on the day of its slot.
    const own = new Map<string, number>();

    for ( const spec of on ) {
      const opened = campaign.opened[ spec.id ];

      if ( !opened ) {
        continue;
      }

      const day = dayOf( Date.parse( opened.slot ) );
      const index = posts.findIndex( (
        p, i
      ) => !claimed.has( i ) && p.sketchKey === keyOf( spec ) && dayOf( p.at ) === day );

      if ( index >= 0 ) {
        claimed.add( index );
        own.set(
          spec.id,
          index
        );
      }
    }

    let origin = Date.parse( campaign.start );
    let last = -Infinity;
    let first = true;
    const laid = new Map<string, LaidBeat>();

    for ( const spec of on ) {
      const target = addDays(
        dayOf( origin ),
        spec.offset
      );
      const accepted = input.accepted?.[ campaign.sketchKey ] ?? 0;
      // Else the first post of the sketch on or after the beat's day — a post
      // made outside the Plan, or moved to another day in Publish. A reel is
      // posted from the host every reel shares, so only an opened one counts.
      const index = own.get( spec.id ) ?? ( hostBeat( spec )
        ? -1
        : posts.findIndex( (
          p, i
        ) => !claimed.has( i ) && p.sketchKey === campaign.sketchKey && dayOf( p.at ) >= target && p.at > last ) );
      let beat: LaidBeat;

      if ( index >= 0 ) {
        const at = posts[ index ].at;

        claimed.add( index );
        beat = {
          spec,
          state: at > input.now ? "queued" : "posted",
          index: 0,
          at,
          slot: null,
          needs: null,
          opened: false
        };
      } else {
        const slot = slots.find( ( s ) => !taken.has( s.toISOString() ) &&
          s.getTime() > last &&
          dayOf( s.getTime() ) >= target &&
          ( perWeek.get( weekOf(
            s,
            tz
          ) ) ?? 0 ) < ( input.weekCap ?? CAMPAIGN_WEEK_CAP ) );

        if ( slot ) {
          taken.add( slot.toISOString() );
        }
        beat = {
          spec,
          state: slot ? "proposed" : "unplaced",
          index: 0,
          at: slot ? slot.getTime() : null,
          slot: slot ? slot.toISOString() : null,
          needs: needsOf(
            spec,
            accepted
          ),
          opened: Boolean( campaign.opened[ spec.id ] )
        };
      }

      if ( beat.at !== null ) {
        count( beat.at );
        last = beat.at;
        if ( first ) {
          origin = beat.at;
        }
      }
      first = false;
      laid.set(
        spec.id,
        beat
      );
    }

    let index = 0;
    const beats = specs.map( ( spec ): LaidBeat => {
      const beat = laid.get( spec.id );

      return beat
        ? {
          ...beat,
          index: ++index
        }
        : {
          spec,
          state: "off",
          index: 0,
          at: null,
          slot: null,
          needs: null,
          opened: false
        };
    } );

    return {
      campaign,
      sketch,
      title,
      name: shortName( title ),
      beats,
      total: on.length,
      live: beats.some( ( b ) => b.state === "proposed" || b.state === "queued" || b.state === "unplaced" )
    };
  } );
}

/** The reel pin of a series beat: the series as the Plan's own Series pillar cuts it. */
function seriesPin(
  sketch: PlanSketch, catalogue: readonly PlanSketch[]
): Pin[ "reel" ] | undefined {
  const proposal = seriesPool( catalogue ).find( ( p ) => p.key === `series:${ sketch.engine }/${ sketch.category }` );

  return proposal?.reel
    ? {
      title: proposal.title,
      subtitle: proposal.reel.subtitle,
      sketches: proposal.reel.sketches,
      pillar: "series"
    }
    : undefined;
}

export interface CampaignPlanInput extends PlanInput {
  /** The free slots `CAMPAIGN_WEEKS` ahead; `slots` (the Plan's five weeks) when absent. */
  farSlots?: readonly Date[];
  accepted?: Readonly<Record<string, number>>;
}

export interface CampaignPlan {
  slots: PlanSlot[];
  campaigns: LaidCampaign[];
}

/**
 * The slots no beat may take: the ones the person skipped or pinned by hand,
 * and a recap's rendezvous (a month closes once). `except` frees one slot —
 * the pinned slot a campaign is about to start on.
 */
export function blockedSlots(
  input: PlanInput, except?: string
): Set<string> {
  const {
    choices, now
  } = input;
  const near = [
    ...input.slots
  ].filter( ( at ) => at.getTime() > now ).sort( (
    a, b
  ) => a.getTime() - b.getTime() );
  const gapMs = choices.gapWeeks * 7 * 86_400_000;
  const recaps = [
    ...rendezvous(
      near,
      input.catalogue,
      input.posted,
      input.timeZone ?? "UTC"
    )
  ].filter( ( [
    , p
  ] ) => !choices.passed[ p.key ] && !( now - ( choices.opened?.[ p.key ] ?? -Infinity ) < gapMs ) )
    .map( ( [
      slot
    ] ) => slot );

  return new Set( [
    ...Object.keys( choices.skipped ),
    ...Object.keys( choices.pins ).filter( ( slot ) => slot !== except ),
    ...recaps
  ] );
}

/**
 * The plan with its campaigns: the beats are laid first, each one pinned to
 * its slot, and `planSlots` fills what is left — so a campaign's sketch is
 * never proposed a second time beside it, and a recap keeps its rendezvous.
 */
export function planWithCampaigns(
  input: CampaignPlanInput, campaigns: readonly Campaign[]
): CampaignPlan {
  if ( !campaigns.length ) {
    return {
      slots: planSlots( input ),
      campaigns: []
    };
  }

  const tz = input.timeZone ?? "UTC";
  const {
    choices, catalogue, now
  } = input;
  const laid = layCampaigns( {
    campaigns,
    slots: input.farSlots ?? input.slots,
    posted: input.posted,
    blocked: blockedSlots( input ),
    catalogue,
    accepted: input.accepted,
    now,
    timeZone: tz
  } );
  const pins: Record<string, Pin> = {
    ...choices.pins
  };
  const passed = {
    ...choices.passed
  };
  const tags = new Map<string, { tag: BeatTag;
    campaign: LaidCampaign;
    beat: LaidBeat; }>();

  for ( const campaign of laid ) {
    const {
      sketch
    } = campaign;

    if ( !sketch || !campaign.live ) {
      continue;
    }

    // While its campaign runs, the sketch is the campaign's: no pillar proposes it beside its beats.
    passed[ `drop:${ campaign.campaign.sketchKey }` ] = now;
    passed[ `favourite:${ campaign.campaign.sketchKey }` ] = now;
    if ( campaign.campaign.template === "finale" && sketch.category ) {
      passed[ `series:${ sketch.engine }/${ sketch.category }` ] = now;
    }

    for ( const beat of campaign.beats ) {
      if ( beat.state !== "proposed" || !beat.slot ) {
        continue;
      }

      const host = beat.spec.kind === "series" || beat.spec.kind === "words";
      const reel = beat.spec.kind === "series"
        ? seriesPin(
          sketch,
          catalogue
        )
        : undefined;

      pins[ beat.slot ] = {
        sketchKey: host ? HOST_KEY : campaign.campaign.sketchKey,
        by: "person",
        ...( reel
          ? {
            reel
          }
          : {} )
      };
      tags.set(
        beat.slot,
        {
          campaign,
          beat,
          tag: {
            id: campaign.campaign.id,
            beat: beat.spec.id,
            kind: beat.spec.kind,
            label: beat.spec.label,
            what: beat.spec.what,
            sketchKey: campaign.campaign.sketchKey,
            series: campaign.title.split( " · " )[ 0 ],
            name: campaign.name,
            index: beat.index,
            total: campaign.total,
            by: campaign.campaign.by,
            needs: beat.needs,
            trial: Boolean( beat.spec.trial ),
            opened: beat.opened,
            ...( beat.spec.pieces
              ? {
                pieces: beat.spec.pieces
              }
              : {} )
          }
        }
      );
    }
  }

  const slots = planSlots( {
    ...input,
    choices: {
      ...choices,
      pins,
      passed
    }
  } ).map( ( slot ): PlanSlot => {
    const found = tags.get( slot.slot );

    if ( !found || !slot.proposal ) {
      return slot;
    }

    const {
      pin: _pin, ...rest
    } = slot.proposal;
    const {
      tag, campaign
    } = found;
    const proposal: BeatProposal = {
      ...rest,
      key: beatKey(
        tag.id,
        tag.beat
      ),
      title: `${ campaign.title } · ${ tag.label }`,
      why: [
        tag.what,
        tag.needs ? `Waits for ${ tag.needs }` : null,
        tag.opened ? "opened in Publish, no post of it known yet" : null
      ].filter( Boolean ).join( " · " ),
      // The words beat is pinned on the host: it is the series', not a new sketch.
      ...( tag.kind === "words"
        ? {
          pillar: "series" as const
        }
        : {} ),
      campaign: tag
    };

    return {
      ...slot,
      proposal
    };
  } );

  return {
    slots,
    campaigns: laid
  };
}

/** Whether `sketchKey` has a campaign with something still to propose. */
export function liveCampaignOf(
  laid: readonly LaidCampaign[], sketchKey: string
): LaidCampaign | null {
  return laid.find( ( c ) => c.live && c.campaign.sketchKey === sketchKey ) ?? null;
}

/**
 * What creating `draft` would give, beside the campaigns already running:
 * the same laying, read for the draft alone — the preview before he confirms.
 */
export function previewCampaign(
  input: LayInput, draft: Campaign
): LaidCampaign {
  const laid = layCampaigns( {
    ...input,
    campaigns: [
      ...input.campaigns.filter( ( c ) => c.id !== draft.id ),
      {
        ...draft,
        createdAt: Math.max(
          draft.createdAt,
          ...input.campaigns.map( ( c ) => c.createdAt + 1 )
        )
      }
    ]
  } );

  return laid.find( ( c ) => c.campaign.id === draft.id )!;
}
