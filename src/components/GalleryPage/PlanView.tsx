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
import {
  DEFAULT_GAP_WEEKS, EMPTY_CHOICES, GAP_WEEKS, MIXES, planSlots, type PlanSketch, type PlanSlot
} from "@/lib/planner/planner";
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
  catalogueThumbnail
} from "./items";
import {
  Vignette
} from "./marks";

const PILLAR_LABEL = {
  drop: "New",
  favourite: "Favourite"
} as const;

const BUTTON = "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";
const INK_BUTTON = "inline-flex h-8 items-center justify-center rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90";
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

function PillarChip( {
  slot
}: {
  slot: PlanSlot;
} ) {
  const p = slot.proposal;

  if ( !p ) {
    return null;
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
  const words = slot.skipped ? "Skipped" : !slot.proposal ? "Nothing left" : slot.proposal.pin ? ( slot.proposal.pin.by === "agent" ? "Pinned by Claude" : "Pinned" ) : "Proposed";

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
  slot, tz, connected, onOpen, onSheet, className
}: {
  slot: PlanSlot;
  tz: string;
  connected: boolean;
  onOpen: ( slot: PlanSlot ) => void;
  onSheet: ( sketchKey: string ) => void;
  className?: string;
} ) {
  const when = whenParts(
    slot.at,
    tz
  );
  const p = slot.proposal;

  return (
    <div className={ clsx(
      "flex flex-col gap-3",
      className
    ) } data-plan-detail
    >
      <div className="flex items-start gap-3">
        <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md bg-hover/60">
          {p && <Vignette src={ catalogueThumbnail( p.sketchKey ) } />}
        </div>
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
            <dt className={ EYEBROW }>Sketch</dt>
            <dd className="font-mono text-[11px] text-foreground/70 [overflow-wrap:anywhere]">{p.path}</dd>
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
              title={ connected ? "Open the sketch on Export › Publish, on this slot" : "Open the sketch — connect your Postiz (menu › Publishing) to schedule it" }
              onClick={ () => onOpen( slot ) }
            >
              {connected ? "Open in Publish" : "Open the sketch"}
            </button>
            <button
              type="button"
              className={ BUTTON }
              data-plan-another
              title="Pass this sketch over and propose the next one"
              onClick={ () => passProposal(
                p.key,
                slot.slot
              ) }
            >
              Another
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
        {p && (
          <button type="button" className={ `${ BUTTON } border-transparent text-foreground/60` } onClick={ () => onSheet( p.sketchKey ) }>
            Its posts
          </button>
        )}
      </div>
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
  rhythm, posts, posted, known, now, onOpen, onSheet, onRhythm
}: {
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

  const slots = useMemo(
    () => !known || !catalogue ? null : planSlots( {
      catalogue,
      slots: planFreeSlots(
        active,
        posts ?? [],
        new Date( now )
      ),
      posted,
      choices,
      now
    } ),
    [
      known,
      catalogue,
      active,
      posts,
      posted,
      choices,
      now
    ]
  );

  const selected = slots?.find( ( s ) => s.slot === picked ) ?? slots?.find( ( s ) => s.proposal ) ?? slots?.[ 0 ] ?? null;
  const weeks = useMemo(
    () => {
      const out = new Map<string, PlanSlot[]>();

      for ( const s of slots ?? [] ) {
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
      slots,
      tz
    ]
  );

  const proposed = slots?.filter( ( s ) => s.proposal ) ?? [];
  const touched = Object.keys( choices.passed ).length + Object.keys( choices.skipped ).length + Object.keys( choices.pins ).length > 0;
  const summary = slots === null
    ? "Reading the catalogue…"
    : `${ proposed.length } of ${ slots.length } free ${ slots.length === 1 ? "slot" : "slots" } proposed · ${ proposed.filter( ( s ) => s.proposal!.pillar === "drop" ).length } new · ${ proposed.filter( ( s ) => s.proposal!.pillar === "favourite" ).length } favourites`;

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
                      <span className="relative block aspect-[4/5] w-10 overflow-hidden rounded bg-hover/60">
                        {s.proposal && <Vignette src={ catalogueThumbnail( s.proposal.sketchKey ) } />}
                      </span>
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
                        className="border-t border-border bg-hover/30 p-3 lg:hidden"
                      />
                    )}
                  </div>
                );
              } )}
            </div>
          ) )}
        </div>

        <aside aria-label="The proposal" className="sticky top-3 rounded-xl border border-border p-3 max-lg:hidden">
          {selected
            ? (
              <Detail
                slot={ selected }
                tz={ tz }
                connected={ Boolean( rhythm ) }
                onOpen={ onOpen }
                onSheet={ onSheet }
              />
            )
            : <p className="text-xs text-foreground/50">{slots === null ? "" : "Nothing to propose."}</p>}
        </aside>
      </div>
    </section>
  );
}
