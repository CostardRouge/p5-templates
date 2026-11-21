"use client";

import React, {
  useEffect, useMemo, useState, useSyncExternalStore
} from "react";
import clsx from "clsx";
import {
  Star
} from "lucide-react";

import {
  weekLabel
} from "@/lib/gallery/calendar";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  beatOf, CAMPAIGN_WEEKS, planWithCampaigns
} from "@/lib/planner/campaign";
import {
  getCampaigns, noCampaigns, passBeat, subscribeCampaigns
} from "@/lib/planner/campaignStore";
import {
  DEFAULT_GAP_WEEKS, EMPTY_CHOICES, GAP_WEEKS, MIXES, sketchKeyOf, sketchPath, type Pillar, type PlanSketch, type PlanSlot
} from "@/lib/planner/planner";
import {
  acceptedCounts
} from "@/lib/variations/kept";
import {
  getChoices, passProposal, resetPlan, skipSlot, subscribeChoices, updateChoices
} from "@/lib/planner/planStore";
import {
  planFreeSlots
} from "@/lib/planner/slots";
import {
  DEFAULT_RHYTHM, slotHead, weekOf, type Rhythm
} from "@/lib/postiz/rhythm";
import {
  BeatDetail, CampaignMaker, CampaignTag, type CampaignContext
} from "./CampaignPanel";
import {
  catalogueThumbnail
} from "./items";
import {
  Vignette
} from "./marks";

const PILLAR_LABEL: Record<Pillar, string> = {
  drop: "New",
  favourite: "Favourite",
  series: "Series",
  recap: "Recap"
};

const BUTTON = "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";
const INK_BUTTON = "inline-flex h-8 items-center justify-center rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const EYEBROW = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/50";

/** `Tue 24 Nov` and `09:00`, in the rhythm's zone. */
function whenParts(
  at: Date, tz: string
): { day: string;
  time: string } {
  return {
    day: at.toLocaleDateString(
      "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: tz
      }
    ).replace(
      ",",
      ""
    ),
    time: at.toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz
      }
    )
  };
}

const NO_ENTRIES: readonly GalleryEntry[] = [];

/** The catalogue, asked for only when the Plan opens: 150 KB the other views never load. */
function useCatalogue(): PlanSketch[] | null {
  const [
    catalogue,
    setCatalogue
  ] = useState<PlanSketch[] | null>( null );

  useEffect(
    () => {
      let live = true;

      void import( "@/sketches/metadata.json" ).then( ( mod ) => {
        if ( live ) {
          setCatalogue( mod.default as PlanSketch[] );
        }
      } );

      return () => {
        live = false;
      };
    },
    []
  );

  return catalogue;
}

/** The picture of a proposal: its sketch, or — for a reel — its first sketch with how many follow. */
function Cover( {
  slot, className
}: {
  slot: PlanSlot;
  className: string;
} ) {
  const p = slot.proposal;
  const reel = p?.reel;

  return (
    <span className={ clsx(
      "relative block aspect-[4/5] shrink-0 overflow-hidden bg-hover/60",
      className
    ) }
    >
      {/* A reel shows its first sketch; a campaign's words card (built on the empty host) its own sketch. */}
      {p && <Vignette src={ catalogueThumbnail( reel ? reel.sketches[ 0 ] : beatOf( p )?.sketchKey ?? p.sketchKey ) } />}
      {reel && (
        <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-foreground px-1 font-mono text-[9px] font-semibold leading-tight text-background">
          {reel.sketches.length}
        </span>
      )}
    </span>
  );
}

/** True when a slot answers the gallery's search and its sketch filter. */
export function slotMatches(
  slot: PlanSlot, needle: string, sketchFilter: string
): boolean {
  const p = slot.proposal;

  if ( !needle && !sketchFilter ) {
    return true;
  }
  if ( !p ) {
    return false;
  }

  const keys = p.reel ? p.reel.sketches : [
    p.sketchKey
  ];
  const name = sketchFilter.split( "/" ).pop() ?? "";

  if ( sketchFilter && !keys.some( ( key ) => key.endsWith( `/${ name }` ) ) ) {
    return false;
  }

  return !needle || [
    p.title,
    p.path,
    p.why,
    ...keys
  ].some( ( text ) => text.toLowerCase().includes( needle ) );
}

function PillarChip( {
  slot
}: {
  slot: PlanSlot;
} ) {
  const p = slot.proposal;
  const beat = beatOf( p );

  if ( !p ) {
    return null;
  }
  if ( beat ) {
    return <CampaignTag tag={ beat } />;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-foreground/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground">
      {p.pillar === "favourite" && <Star className="h-2.5 w-2.5 fill-current" aria-hidden />}
      {PILLAR_LABEL[ p.pillar ]}
    </span>
  );
}

function StateWord( {
  slot
}: {
  slot: PlanSlot;
} ) {
  const words = slot.skipped ? "Skipped" : !slot.proposal ? "Nothing left" : beatOf( slot.proposal ) ? ( beatOf( slot.proposal )!.needs ? "Waiting" : "Campaign" ) : slot.proposal.pin ? ( slot.proposal.pin.by === "agent" ? "Pinned by Claude" : "Pinned" ) : "Proposed";

  return (
    <span className={ clsx(
      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px]",
      slot.skipped || !slot.proposal ? "text-foreground/45" : "text-foreground/80"
    ) }
    >
      <i
        aria-hidden
        className={ clsx(
          "inline-block h-2 w-2 rounded-full border",
          slot.proposal?.pin ? "border-foreground bg-foreground" : "border-dashed border-foreground/60"
        ) }
      />
      {words}
    </span>
  );
}

/** What a slot proposes, and the three gestures on it. */
function Detail( {
  slot, tz, connected, onOpen, onSheet, className, campaign
}: {
  slot: PlanSlot;
  tz: string;
  connected: boolean;
  onOpen: ( slot: PlanSlot ) => void;
  onSheet: ( sketchKey: string ) => void;
  className?: string;
  /** The calendar and the pieces a campaign reads; null until the plan is read. */
  campaign: CampaignContext | null;
} ) {
  const when = whenParts(
    slot.at,
    tz
  );
  const p = slot.proposal;
  const beat = beatOf( p );
  // The variations wait for accepted pieces; the words are typed once the card is open.
  const waits = beat?.kind === "variations" && beat.needs ? beat.needs : null;

  return (
    <div className={ clsx(
      "flex flex-col gap-3",
      className
    ) } data-plan-detail
    >
      <div className="flex items-start gap-3">
        <Cover slot={ slot } className="w-20 rounded-md" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
            {p ? p.title : slot.skipped ? "Left empty" : "Nothing left to propose"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <PillarChip slot={ slot } />
            <StateWord slot={ slot } />
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        <dt className={ EYEBROW }>When</dt>
        <dd className="text-foreground">{when.day} · {when.time} <span className="text-foreground/50">{tz}</span></dd>
        {p && (
          <>
            <dt className={ EYEBROW }>Why</dt>
            <dd className="text-foreground/70 [overflow-wrap:anywhere]">{p.why}</dd>
            {p.reel
              ? (
                <>
                  <dt className={ EYEBROW }>Reel</dt>
                  <dd className="flex flex-wrap gap-1" data-plan-reel>
                    {p.reel.sketches.map( ( key ) => (
                      <span key={ key } title={ key } className="relative block aspect-[4/5] w-8 overflow-hidden rounded-sm bg-hover/60">
                        <Vignette src={ catalogueThumbnail( key ) } />
                      </span>
                    ) )}
                  </dd>
                </>
              )
              : (
                <>
                  <dt className={ EYEBROW }>Sketch</dt>
                  <dd className="font-mono text-[11px] text-foreground/70 [overflow-wrap:anywhere]">{p.path}</dd>
                </>
              )}
          </>
        )}
        {!p && !slot.skipped && (
          <>
            <dt className={ EYEBROW }>Why</dt>
            <dd className="text-foreground/70">Every new sketch and every favourite is already in the plan, was passed over, or was posted too recently. Shorten the gap or reset the plan.</dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        {p && (
          <>
            <button
              type="button"
              className={ INK_BUTTON }
              data-plan-open
              disabled={ Boolean( waits ) }
              title={ waits
                ? `It waits for ${ waits }`
                : p.reel
                  ? ( connected ? "Build this reel on the empty sketch and open Export › Publish on this slot" : "Build this reel on the empty sketch — connect your Postiz (menu › Publishing) to schedule it" )
                  : ( connected ? "Open the sketch on Export › Publish, on this slot" : "Open the sketch — connect your Postiz (menu › Publishing) to schedule it" ) }
              onClick={ () => onOpen( slot ) }
            >
              {waits ? "Waiting for variations" : connected ? "Open in Publish" : p.reel ? "Build the reel" : "Open the sketch"}
            </button>
            <button
              type="button"
              className={ BUTTON }
              data-plan-another
              title={ beat ? "Leave this beat out of its campaign; the slot goes back to the plan" : "Pass this sketch over and propose the next one" }
              onClick={ () => beat
                ? passBeat(
                  beat.id,
                  beat.beat
                )
                : passProposal(
                  p.key,
                  slot.slot
                ) }
            >
              {beat ? "Leave out" : "Another"}
            </button>
          </>
        )}
        <button
          type="button"
          className={ BUTTON }
          data-plan-skip
          title={ slot.skipped ? "Propose for this slot again" : "Leave this slot empty" }
          onClick={ () => skipSlot(
            slot.slot,
            !slot.skipped
          ) }
        >
          {slot.skipped ? "Propose again" : "Skip"}
        </button>
        {p && !p.reel && beat?.kind !== "words" && (
          <button type="button" className={ `${ BUTTON } border-transparent text-foreground/60` } onClick={ () => onSheet( p.sketchKey ) }>
            Its posts
          </button>
        )}
      </div>

      {p && campaign && ( beat
        ? <BeatDetail slot={ slot } tag={ beat } ctx={ campaign } />
        : !p.reel && <CampaignMaker key={ slot.slot } slot={ slot } ctx={ campaign } /> )}
    </div>
  );
}

/**
 * The gallery's PLAN (lab 7, `docs/memory/publishing.md`): what to post on
 * each free slot of the rhythm over the coming weeks, proposed from the
 * catalogue — new sketches in the order of their series, favourites never
 * posted too recently (`planner.ts`). Three gestures per line: open it on
 * Export › Publish with its slot, ask for another, skip the slot. Nothing is
 * sent from here.
 *
 * It is the page's last block and its lines have a fixed height, so what
 * loads late (the catalogue, Postiz) lands in place and moves nothing.
 */
export default function PlanView( {
  rhythm, posts, posted, known, now, onOpen, onSheet, onRhythm, search = "", sketchFilter = "", onSketches, entries = NO_ENTRIES
}: {
  /** The gallery's pieces: a campaign's variations are the accepted ones among them. */
  entries?: readonly GalleryEntry[];
  /** The kept Postiz's rhythm; null without a Postiz (the default rhythm is drawn). */
  rhythm: Rhythm | null;
  /** Every post Postiz lists (any app's); null until read or without a Postiz. */
  posts: readonly { publishDate: string;
    state: string }[] | null;
  /** Every known send of a sketch. */
  posted: readonly { sketchKey: string;
    at: number }[];
  /** False until the archive and Postiz are read: nothing is proposed on half the facts. */
  known: boolean;
  now: number;
  onOpen: ( slot: PlanSlot ) => void;
  onSheet: ( sketchKey: string ) => void;
  onRhythm: () => void;
  /** The gallery's search, lower-cased, and its sketch filter: they narrow what is SHOWN, never what is planned. */
  search?: string;
  sketchFilter?: string;
  /** The sketches the plan proposes, `engine/category/name`, for the gallery's sketch filter. */
  onSketches?: ( paths: string[] ) => void;
} ) {
  const catalogue = useCatalogue();
  const choices = useSyncExternalStore(
    subscribeChoices,
    getChoices,
    () => EMPTY_CHOICES
  );
  const [
    picked,
    setPicked
  ] = useState<string | null>( null );
  const active = rhythm ?? DEFAULT_RHYTHM;
  const tz = active.timeZone;

  const campaigns = useSyncExternalStore(
    subscribeCampaigns,
    getCampaigns,
    noCampaigns
  );

  // The plan and its campaigns (lab 9): the beats are laid first, each one a
  // line wearing its tag; with no campaign this is `planSlots` itself.
  const reading = useMemo(
    () => {
      if ( !known || !catalogue ) {
        return null;
      }

      const plan = {
        catalogue,
        slots: planFreeSlots(
          active,
          posts ?? [],
          new Date( now )
        ),
        posted,
        choices,
        now,
        timeZone: tz
      };
      const lay = {
        slots: planFreeSlots(
          active,
          posts ?? [],
          new Date( now ),
          CAMPAIGN_WEEKS
        ),
        posted,
        catalogue,
        accepted: acceptedCounts( entries ),
        now,
        timeZone: tz
      };
      const out = planWithCampaigns(
        {
          ...plan,
          farSlots: lay.slots,
          accepted: lay.accepted
        },
        campaigns
      );
      const context: CampaignContext = {
        plan,
        lay,
        campaigns,
        laid: out.campaigns,
        entries,
        tz
      };

      return {
        slots: out.slots,
        context
      };
    },
    [
      known,
      catalogue,
      active,
      posts,
      posted,
      choices,
      campaigns,
      entries,
      now,
      tz
    ]
  );
  const slots = reading?.slots ?? null;
  const context = reading?.context ?? null;

  const shown = useMemo(
    () => slots?.filter( ( s ) => slotMatches(
      s,
      search,
      sketchFilter
    ) ) ?? null,
    [
      slots,
      search,
      sketchFilter
    ]
  );
  const paths = useMemo(
    () => {
      if ( !slots || !catalogue ) {
        return [];
      }

      const pathOf = new Map( catalogue.map( ( s ) => [
        sketchKeyOf( s ),
        sketchPath( s )
      ] ) );

      return [
        ...new Set( slots.flatMap( ( s ) => !s.proposal ? [] : s.proposal.reel ? s.proposal.reel.sketches.map( ( key ) => pathOf.get( key ) ?? key ) : [
          s.proposal.path
        ] ) )
      ].sort();
    },
    [
      slots,
      catalogue
    ]
  );

  useEffect(
    () => onSketches?.( paths ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- told when the plan's sketches change, not when the callback does
    [
      paths
    ]
  );

  const selected = shown?.find( ( s ) => s.slot === picked ) ?? shown?.find( ( s ) => s.proposal ) ?? shown?.[ 0 ] ?? null;
  const weeks = useMemo(
    () => {
      const out = new Map<string, PlanSlot[]>();

      for ( const s of shown ?? [] ) {
        const monday = weekOf(
          s.at,
          tz
        );

        out.set(
          monday,
          [
            ...( out.get( monday ) ?? [] ),
            s
          ]
        );
      }

      return [
        ...out.entries()
      ];
    },
    [
      shown,
      tz
    ]
  );

  const proposed = slots?.filter( ( s ) => s.proposal ) ?? [];
  const touched = Object.keys( choices.passed ).length + Object.keys( choices.skipped ).length + Object.keys( choices.pins ).length > 0;
  const summary = slots === null
    ? "Reading the catalogue…"
    : [
      `${ proposed.length } of ${ slots.length } free ${ slots.length === 1 ? "slot" : "slots" } proposed`,
      ...( [
        [
          "drop",
          "new"
        ],
        [
          "favourite",
          "favourites"
        ],
        [
          "series",
          "series"
        ],
        [
          "recap",
          "recaps"
        ]
      ] as const ).map( ( [
        pillar,
        word
      ] ) => [
        // A campaign's beats are counted once, as the campaign's.
        proposed.filter( ( s ) => s.proposal!.pillar === pillar && !beatOf( s.proposal ) ).length,
        word
      ] as const ).filter( ( [
        count
      ] ) => count > 0 )
        .map( ( [
          count,
          word
        ] ) => `${ count } ${ word }` ),
      ...( proposed.some( ( s ) => beatOf( s.proposal ) ) ? [
        `${ proposed.filter( ( s ) => beatOf( s.proposal ) ).length } of a campaign`
      ] : [] ),
      ...( shown && shown.length !== slots.length ? [
        `${ shown.length } shown`
      ] : [] )
    ].join( " · " );

  return (
    <section aria-label="Plan" className="flex flex-col gap-3" data-plan-ready={ slots ? "true" : "false" }>
      {/* Every width here is fixed or flexed; the summary truncates. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div role="radiogroup" aria-label="Mix" className="inline-flex h-9 shrink-0 items-center gap-0.5 self-start rounded-lg border border-border bg-hover/40 p-0.5">
          {MIXES.map( ( m ) => (
            <button
              key={ m.id }
              type="button"
              role="radio"
              aria-checked={ choices.mix === m.id }
              title={ m.title }
              data-plan-mix={ m.id }
              onClick={ () => updateChoices( ( c ) => ( {
                ...c,
                mix: m.id
              } ) ) }
              className={ clsx(
                "inline-flex h-full items-center rounded-md px-2.5 text-xs font-medium transition-colors",
                choices.mix === m.id ? "bg-background text-foreground shadow-[0_0_0_1px_var(--color-border)]" : "text-foreground/60 hover:text-foreground"
              ) }
            >
              {m.label}
            </button>
          ) )}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="flex shrink-0 items-center gap-2 text-xs text-foreground/60">
            No repeat before
            <select
              aria-label="No repeat before"
              value={ choices.gapWeeks ?? DEFAULT_GAP_WEEKS }
              onChange={ ( event ) => updateChoices( ( c ) => ( {
                ...c,
                gapWeeks: Number( event.target.value )
              } ) ) }
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-focus"
            >
              {GAP_WEEKS.map( ( w ) => <option key={ w } value={ w }>{w} weeks</option> )}
            </select>
          </label>
          <button
            type="button"
            onClick={ onRhythm }
            title={ rhythm ? "Your rhythm — change it in Publishing" : "The default rhythm — connect your Postiz in Publishing to use yours" }
            className="min-w-0 truncate text-left font-mono text-[11px] text-foreground/55 underline-offset-2 hover:text-foreground hover:underline"
          >
            {active.slots.map( slotHead ).join( " · " )}{rhythm ? "" : " · default rhythm"}
          </button>
          {touched && (
            <button type="button" className={ `${ BUTTON } ml-auto shrink-0` } onClick={ () => resetPlan() } title="Forget what was passed over, skipped and pinned">
              Reset
            </button>
          )}
        </div>
      </div>

      <p className="truncate font-mono text-[11px] text-foreground/55" data-plan-summary title={ summary }>{summary}</p>

      <div className="grid min-h-[36rem] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-xl border border-border">
          {slots !== null && slots.length > 0 && shown?.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-foreground/60">
              Nothing in the plan matches — clear the search or pick another sketch.
            </p>
          )}
          {slots !== null && slots.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-foreground/60">
              No free slot in the next five weeks: every slot of your rhythm already has a post.
            </p>
          )}
          {weeks.map( ( [
            monday,
            list
          ] ) => (
            <div key={ monday }>
              <div className={ `${ EYEBROW } border-b border-border bg-hover/50 px-3 py-2` }>Week of {weekLabel( monday )}</div>
              {list.map( ( s ) => {
                const when = whenParts(
                  s.at,
                  tz
                );
                const on = selected?.slot === s.slot;

                return (
                  <div key={ s.slot } className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={ on }
                      data-plan-slot={ s.slot }
                      onClick={ () => setPicked( s.slot ) }
                      className={ clsx(
                        "grid h-16 w-full grid-cols-[4.75rem_2.5rem_minmax(0,1fr)] items-center gap-3 px-3 text-left transition-colors sm:grid-cols-[5.5rem_2.5rem_minmax(0,1fr)_auto]",
                        on ? "bg-hover" : "hover:bg-hover/50"
                      ) }
                    >
                      <span className="font-mono text-[11px] leading-tight tabular-nums text-foreground/70">{when.day}<br />{when.time}</span>
                      <Cover slot={ s } className="w-10 rounded" />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className={ clsx(
                          "truncate text-sm font-semibold",
                          s.proposal ? "text-foreground" : "text-foreground/45"
                        ) }
                        >
                          {s.proposal ? s.proposal.title : s.skipped ? "Left empty" : "Nothing left to propose"}
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <PillarChip slot={ s } />
                          <span className="truncate font-mono text-[11px] text-foreground/50">{s.proposal?.why ?? ""}</span>
                        </span>
                      </span>
                      <span className="max-sm:hidden"><StateWord slot={ s } /></span>
                    </button>
                    {on && (
                      <Detail
                        slot={ s }
                        tz={ tz }
                        connected={ Boolean( rhythm ) }
                        onOpen={ onOpen }
                        onSheet={ onSheet }
                        campaign={ context }
                        className="border-t border-border bg-hover/30 p-3 lg:hidden"
                      />
                    )}
                  </div>
                );
              } )}
            </div>
          ) )}
        </div>

        <aside aria-label="The proposal" className="sticky top-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl border border-border p-3 max-lg:hidden">
          {selected
            ? (
              <Detail
                slot={ selected }
                tz={ tz }
                connected={ Boolean( rhythm ) }
                onOpen={ onOpen }
                onSheet={ onSheet }
                campaign={ context }
              />
            )
            : <p className="text-xs text-foreground/50">{slots === null ? "" : "Nothing to propose."}</p>}
        </aside>
      </div>
    </section>
  );
}
