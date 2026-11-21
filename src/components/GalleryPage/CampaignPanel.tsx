"use client";

import React, {
  useMemo, useState
} from "react";
import clsx from "clsx";

import {
  getGalleryStore
} from "@/lib/gallery/store";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  beatProblem, blockedSlots, CAMPAIGN_WEEK_CAP, liveCampaignOf, makeCampaign, previewCampaign, TEMPLATES, templatesFor, type BeatTag, type Campaign, type CampaignTemplate, type LaidBeat, type LaidCampaign, type LayInput
} from "@/lib/planner/campaign";
import {
  addCampaign, dropCampaign, passBeat
} from "@/lib/planner/campaignStore";
import {
  sketchKeyOf, type PlanInput, type PlanSlot
} from "@/lib/planner/planner";
import {
  pinSlot
} from "@/lib/planner/planStore";
import {
  variationsOf
} from "@/lib/variations/kept";
import {
  Vignette
} from "./marks";

const BUTTON = "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";
const INK_BUTTON = "inline-flex h-8 items-center justify-center rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40";
const SMALL_BUTTON = "inline-flex h-6 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-hover";
const SMALL_INK = "inline-flex h-6 min-w-0 flex-1 items-center justify-center rounded-md bg-foreground px-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-90";
const EYEBROW = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/50";

/** What the Plan hands the campaign's pieces: the calendar a beat is laid on, and the gallery's pieces. */
export interface CampaignContext {
  /** The plan's own input: what a beat may not take is read from it (`blockedSlots`). */
  plan: PlanInput;
  /** The calendar as far as a campaign reaches. */
  lay: Omit<LayInput, "campaigns" | "blocked">;
  campaigns: readonly Campaign[];
  laid: readonly LaidCampaign[];
  entries: readonly GalleryEntry[];
  tz: string;
}

function dayLabel(
  at: number, tz: string
): string {
  return new Date( at ).toLocaleDateString(
    "en-GB",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz
    }
  )
    .replace(
      ",",
      ""
    );
}

/** The tag a campaign's line wears: `Smoke · 2/4`. */
export function CampaignTag( {
  tag
}: {
  tag: BeatTag;
} ) {
  return (
    <span
      data-campaign-tag={ tag.id }
      title={ `Beat ${ tag.index } of ${ tag.total } of ${ tag.name }'s campaign${ tag.by === "agent" ? " — proposed by Claude" : "" }` }
      className="inline-flex shrink-0 items-center rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.04em] text-background"
    >
      {tag.name} · {tag.index}/{tag.total}
    </span>
  );
}

function beatWhen(
  beat: LaidBeat, tz: string
): string {
  switch ( beat.state ) {
    case "off":
      return "left out";
    case "unplaced":
      return "no free slot yet";
    case "posted":
      return `posted ${ dayLabel(
        beat.at!,
        tz
      ) }`;
    case "queued":
      return `queued ${ dayLabel(
        beat.at!,
        tz
      ) }`;
    default:
      return dayLabel(
        beat.at!,
        tz
      );
  }
}

/**
 * «Create its campaign» on a line of the Plan (lab 9, shape A): the beats
 * with the dates they would take, each one unticked at will, then one press.
 * The Plan proposes it; nothing starts a campaign by itself.
 */
export function CampaignMaker( {
  slot, ctx
}: {
  slot: PlanSlot;
  ctx: CampaignContext;
} ) {
  const p = slot.proposal;
  const sketch = useMemo(
    () => p ? ctx.lay.catalogue.find( ( s ) => sketchKeyOf( s ) === p.sketchKey ) ?? null : null,
    [
      ctx.lay.catalogue,
      p
    ]
  );
  const offered = useMemo(
    () => sketch
      ? templatesFor(
        sketch,
        ctx.lay.catalogue
      )
      : [],
    [
      sketch,
      ctx.lay.catalogue
    ]
  );
  const [
    open,
    setOpen
  ] = useState( false );
  const [
    picked,
    setPicked
  ] = useState<CampaignTemplate | null>( null );
  const [
    off,
    setOff
  ] = useState<string[]>( [] );
  const template = picked && offered.includes( picked ) ? picked : offered[ 0 ];

  const preview = useMemo(
    () => {
      if ( !open || !sketch || !template ) {
        return null;
      }

      const draft = makeCampaign(
        sketch,
        ctx.lay.catalogue,
        template,
        slot.slot,
        ctx.lay.now,
        "person",
        off
      );

      return previewCampaign(
        {
          ...ctx.lay,
          campaigns: ctx.campaigns,
          // The slot it starts on may wear a pin the campaign replaces.
          blocked: blockedSlots(
            ctx.plan,
            slot.slot
          )
        },
        draft
      );
    },
    [
      open,
      sketch,
      template,
      slot.slot,
      off,
      ctx
    ]
  );

  if ( !p || !sketch || !template ) {
    return null;
  }

  const running = liveCampaignOf(
    ctx.laid,
    p.sketchKey
  );

  if ( running ) {
    return (
      <p className="font-mono text-[11px] text-foreground/55" data-campaign-running>
        Its campaign is running — {running.beats.filter( ( b ) => b.state === "proposed" ).length} beats proposed.
      </p>
    );
  }

  if ( !open || !preview ) {
    return (
      <button
        type="button"
        className={ `${ BUTTON } self-start` }
        data-campaign-create
        title="See the posts this sketch would get over the coming weeks — its release, then what prolongs it — before deciding"
        onClick={ () => setOpen( true ) }
      >
        Create its campaign
      </button>
    );
  }

  const on = preview.beats.filter( ( b ) => b.state !== "off" );
  const later = on.filter( ( b ) => b.at !== null && b.at - ctx.lay.now > 35 * 86_400_000 );

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3" data-campaign-preview>
      <div className="flex flex-wrap items-center gap-2">
        <span className={ EYEBROW }>Its campaign</span>
        {offered.length > 1 && (
          <div role="radiogroup" aria-label="Template" className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-hover/40 p-0.5">
            {offered.map( ( id ) => (
              <button
                key={ id }
                type="button"
                role="radio"
                aria-checked={ template === id }
                title={ TEMPLATES[ id ].title }
                data-campaign-template={ id }
                onClick={ () => {
                  setPicked( id );
                  setOff( [] );
                } }
                className={ clsx(
                  "inline-flex h-full items-center rounded px-2 text-[11px] font-medium transition-colors",
                  template === id ? "bg-background text-foreground shadow-[0_0_0_1px_var(--color-border)]" : "text-foreground/60 hover:text-foreground"
                ) }
              >
                {TEMPLATES[ id ].label}
              </button>
            ) )}
          </div>
        )}
      </div>

      <ul className="flex flex-col">
        {preview.beats.map( ( beat ) => {
          const problem = beatProblem(
            beat.spec,
            sketch,
            ctx.lay.catalogue
          );
          const ticked = beat.state !== "off";

          return (
            <li key={ beat.spec.id } className="border-t border-border first:border-t-0">
              <label className={ clsx(
                "grid grid-cols-[auto_5.25rem_minmax(0,1fr)] items-start gap-x-2.5 py-2 text-xs",
                problem ? "cursor-not-allowed" : "cursor-pointer"
              ) }
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ ticked }
                  disabled={ Boolean( problem ) }
                  data-campaign-beat={ beat.spec.id }
                  onChange={ ( event ) => setOff( ( list ) => event.target.checked ? list.filter( ( id ) => id !== beat.spec.id ) : [
                    ...list,
                    beat.spec.id
                  ] ) }
                />
                <span className={ clsx(
                  "font-mono text-[11px] tabular-nums",
                  ticked ? "text-foreground" : "text-foreground/40"
                ) } data-campaign-date
                >
                  {ticked
                    ? ( beat.at !== null
                      ? dayLabel(
                        beat.at,
                        ctx.tz
                      )
                      : "no free slot" )
                    : `day ${ beat.spec.offset ? `+${ beat.spec.offset }` : "0" }`}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={ clsx(
                    "font-semibold",
                    ticked ? "text-foreground" : "text-foreground/45"
                  ) }
                  >
                    {beat.spec.label}
                  </span>
                  <span className="text-foreground/60 [overflow-wrap:anywhere]">{problem ?? beat.spec.what}</span>
                  {ticked && beat.needs && <span className="text-foreground/60">Waits for {beat.needs}.</span>}
                </span>
              </label>
            </li>
          );
        } )}
      </ul>

      <p className="font-mono text-[11px] text-foreground/55">
        {on.length} {on.length === 1 ? "beat" : "beats"} · {CAMPAIGN_WEEK_CAP} a week at most{later.length ? ` · ${ later.length } beyond the plan's five weeks` : ""} · each one a line of the Plan you open, pass or skip
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={ INK_BUTTON }
          disabled={ !on.length }
          data-campaign-confirm
          onClick={ () => {
            // The release takes the place of a pin on its slot.
            if ( p.pin ) {
              pinSlot(
                slot.slot,
                null
              );
            }
            addCampaign( {
              ...preview.campaign,
              createdAt: Date.now()
            } );
            setOpen( false );
          } }
        >
          Create · {on.length} {on.length === 1 ? "beat" : "beats"}
        </button>
        <button type="button" className={ BUTTON } onClick={ () => setOpen( false ) }>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * A kept piece's place among its sketch's variations (lab 9, Q4): a candidate
 * is accepted or discarded, an accepted one can be taken back, and a piece
 * the person kept can be made a variation — accepted at once, it is their own
 * choice. Only accepted pieces enter a Variations post.
 */
export function VariationControl( {
  entry
}: {
  entry: Pick<GalleryEntry, "id" | "variation">;
} ) {
  const store = getGalleryStore();
  const mark = entry.variation;

  if ( !mark ) {
    return (
      <button
        type="button"
        className={ `${ SMALL_BUTTON } border-dashed text-foreground/70` }
        data-variation-use
        title="Use this piece as a variation of its sketch: it may go in a campaign's Variations post"
        onClick={ () => void store.mark(
          entry.id,
          {
            state: "accepted",
            by: "person"
          }
        ) }
      >
        + Variation
      </button>
    );
  }

  if ( mark.state === "accepted" ) {
    return (
      <button
        type="button"
        className={ SMALL_BUTTON }
        data-variation-undo
        title={ mark.by === "agent" ? "Take your yes back: it becomes a candidate again" : "Not a variation after all: the piece stays in the gallery" }
        onClick={ () => void store.mark(
          entry.id,
          mark.by === "agent"
            ? {
              ...mark,
              state: "candidate"
            }
            : null
        ) }
      >
        Accepted ✓
      </button>
    );
  }

  return (
    <span className="flex gap-1">
      <button
        type="button"
        className={ SMALL_INK }
        data-variation-accept
        title="Accept it: it may go in the Variations post"
        onClick={ () => void store.mark(
          entry.id,
          {
            ...mark,
            state: "accepted"
          }
        ) }
      >
        Accept
      </button>
      <button
        type="button"
        className={ SMALL_BUTTON }
        data-variation-discard
        aria-label="Discard this candidate"
        title={ mark.by === "agent" ? "Discard it: the piece Claude kept is deleted from the gallery" : "Not a variation after all: the piece stays in the gallery" }
        onClick={ () => void ( mark.by === "agent"
          ? store.remove( entry.id )
          : store.mark(
            entry.id,
            null
          ) ) }
      >
        ✕
      </button>
    </span>
  );
}

/** A sketch's variations as the Plan shows them: accept the good candidates, discard the others. */
function VariationStrip( {
  sketchKey, ctx, tag
}: {
  sketchKey: string;
  ctx: CampaignContext;
  tag: BeatTag;
} ) {
  const pieces = variationsOf(
    ctx.entries,
    sketchKey
  );
  const accepted = pieces.filter( ( e ) => e.variation!.state === "accepted" ).length;

  return (
    <div className="flex flex-col gap-2" data-variations>
      <p className="text-xs text-foreground/70">
        {accepted} accepted{tag.pieces ? ` of ${ tag.pieces.min === tag.pieces.max ? tag.pieces.min : `${ tag.pieces.min } to ${ tag.pieces.max }` }` : ""}
        {pieces.length - accepted > 0 ? ` · ${ pieces.length - accepted } waiting for your yes` : ""}
        {!pieces.length && " — keep other looks of the sketch as variations («+ Variation» on a piece of its sheet), or ask Claude to propose some in the studio."}
      </p>
      {pieces.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
          {pieces.map( ( entry ) => {
            const mark = entry.variation!;
            const isAccepted = mark.state === "accepted";

            return (
              <li key={ entry.id } className="flex flex-col gap-1" data-variation={ mark.state }>
                <span
                  className={ clsx(
                    "relative block aspect-[4/5] overflow-hidden rounded-md bg-hover/60",
                    isAccepted ? "ring-2 ring-foreground" : "border border-dashed border-foreground/50"
                  ) }
                  title={ mark.label ?? entry.title }
                >
                  <Vignette blob={ entry.thumbnail } />
                </span>
                <span className="truncate font-mono text-[10px] text-foreground/60" title={ mark.label ?? "" }>
                  {mark.label ?? ( entry.title || "Variation" )}
                </span>
                <VariationControl entry={ entry } />
              </li>
            );
          } )}
        </ul>
      )}
    </div>
  );
}

/** A beat's line, opened: its campaign beat by beat, the variations to accept, and the way out. */
export function BeatDetail( {
  slot, tag, ctx
}: {
  slot: PlanSlot;
  tag: BeatTag;
  ctx: CampaignContext;
} ) {
  const laid = ctx.laid.find( ( c ) => c.campaign.id === tag.id );

  if ( !laid || !slot.proposal ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3" data-campaign={ tag.id }>
      <div className="flex items-center gap-2">
        <span className={ EYEBROW }>{TEMPLATES[ laid.campaign.template ].label} campaign</span>
        {laid.campaign.by === "agent" && <span className="font-mono text-[10.5px] text-foreground/55">proposed by Claude</span>}
      </div>
      <ol className="flex flex-col">
        {laid.beats.map( ( beat ) => (
          <li
            key={ beat.spec.id }
            data-campaign-row={ beat.spec.id }
            data-state={ beat.state }
            className={ clsx(
              "grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 border-t border-border py-1.5 text-xs first:border-t-0",
              beat.state === "off" && "text-foreground/45"
            ) }
          >
            <span className="font-mono text-[11px] tabular-nums text-foreground/55">{beat.index || "–"}</span>
            <span className={ clsx(
              "truncate",
              beat.spec.id === tag.beat && "font-semibold text-foreground"
            ) }
            >
              {beat.spec.label}
              {beat.opened && <span className="font-normal text-foreground/50"> · opened</span>}
            </span>
            <span className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-foreground/70">
              {beatWhen(
                beat,
                ctx.tz
              )}
              {beat.state === "off" && (
                <button
                  type="button"
                  className={ SMALL_BUTTON }
                  onClick={ () => passBeat(
                    laid.campaign.id,
                    beat.spec.id,
                    false
                  ) }
                >
                  Put back
                </button>
              )}
            </span>
          </li>
        ) )}
      </ol>

      {tag.kind === "variations" && (
        <VariationStrip sketchKey={ slot.proposal.sketchKey } ctx={ ctx } tag={ tag } />
      )}

      <button
        type="button"
        className={ `${ SMALL_BUTTON } self-start border-transparent text-foreground/60` }
        data-campaign-drop
        title="Forget this campaign: its lines leave the Plan. Posts already sent or queued are not touched."
        onClick={ () => {
          if ( window.confirm( `Drop the campaign of ${ laid.title }? Its lines leave the Plan; what was already posted or queued stays.` ) ) {
            dropCampaign( laid.campaign.id );
          }
        } }
      >
        Drop the campaign
      </button>
    </div>
  );
}
