"use client";

import React, {
  useState
} from "react";
import clsx from "clsx";
import {
  rhythmGrid, slotHead, slotLabel, type Rhythm
} from "@/lib/postiz/rhythm";
import type {
  When
} from "@/lib/postiz/publishStore";

/** `2026-11-17T09:00` for a datetime-local input, in this browser's own zone. */
const localInput = ( d: Date ) => new Date( d.getTime() - d.getTimezoneOffset() * 60000 ).toISOString()
  .slice(
    0,
    16
  );

/** A custom time's starting point when none is chosen yet. */
function inAnHour(): Date {
  return new Date( Date.now() + 3600000 );
}

const CELL = "grid min-h-8 place-items-center rounded-md border text-xs tabular-nums transition-colors pointer-coarse:min-h-11";
const FREE = "cursor-pointer border-theme bg-background text-foreground hover:border-foreground";
const ON = "cursor-pointer border-foreground bg-foreground font-medium text-background";
const BUTTON = "inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors pointer-coarse:min-h-11";

/**
 * When a post goes out — Atelier's card (its lab 13), in Sketchbook's ink:
 * the ANSWER first, the slot in big type (the next free one of the rhythm
 * until another is picked), then *Change* folding out the rhythm as a grid —
 * its slots as columns, this week and the next two as rows, a taken slot
 * struck out, a gone one dashed — and *Another time… · Now · Draft* on one row.
 * A broken rhythm is a line in the card, never a refusal.
 */
export default function WhenCard( {
  rhythm, taken, when, at, free, warnings, onChoose
}: {
  rhythm: Rhythm;
  /** Postiz's planned posts. */
  taken: readonly Date[];
  when: When;
  /** What `when` resolves to (`planPost`). */
  at: Date | "now" | "draft" | null;
  free: Date | null;
  warnings: readonly string[];
  onChoose: ( next: When ) => void;
} ) {
  const [
    open,
    setOpen
  ] = useState( false );
  const tz = rhythm.timeZone;
  const instant = at instanceof Date ? at : null;
  const custom = when.kind === "at" && when.custom === true;
  const big = at === "now" ? "Now" : at === "draft" ? "A draft in Postiz" : instant ? slotLabel(
    instant,
    tz
  ) : "Choose a time";
  const sub = at === "now"
    ? "Published as soon as it is sent"
    : at === "draft"
      ? when.kind === "draft" ? "Nothing scheduled: you finish it in Postiz" : "No free slot in sight — kept as a draft"
      : custom
        ? `A time of yours · ${ tz.replace(
          /_/g,
          " "
        ) }`
        : instant && free && instant.getTime() === free.getTime()
          ? "The next free slot of your rhythm"
          : "A slot of your rhythm";
  const grid = open ? rhythmGrid(
    rhythm,
    taken,
    new Date()
  ) : null;
  const columns = {
    gridTemplateColumns: `4.5rem repeat(${ grid?.slots.length ?? 1 }, minmax(0, 1fr))`
  };
  const pick = ( k: "custom" | "now" | "draft" ) => k === "custom"
    ? onChoose( {
      kind: "at",
      at: ( instant ?? inAnHour() ).toISOString(),
      custom: true
    } )
    : onChoose( {
      kind: k
    } );

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-theme">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold tabular-nums text-foreground">{big}</div>
          <div className="truncate text-[11px] text-label">{sub}</div>
        </div>
        <button
          type="button"
          aria-expanded={ open }
          onClick={ () => setOpen( ( o ) => !o ) }
          className={ clsx(
            BUTTON,
            open ? "border-transparent bg-foreground text-background" : "border-theme bg-background text-foreground hover:bg-hover"
          ) }
        >
          {open ? "Done" : "Change"}
        </button>
      </div>

      {warnings.length > 0 && (
        <div role="status" className="flex flex-col gap-0.5 border-t border-theme px-3 py-1.5 text-[11px] text-amber-500">
          {warnings.map( ( w ) => <span key={ w }>{w} Still yours to send.</span> )}
        </div>
      )}

      {grid && (
        <div className="flex flex-col gap-1.5 border-t border-theme px-3 pb-3 pt-2">
          <div className="grid items-end gap-1" style={ columns } aria-hidden="true">
            <span />
            {grid.slots.map( ( s ) => (
              <span key={ `${ s.day }-${ s.time }` } className="text-center font-mono text-[10px] text-label">
                {slotHead( s )}
              </span>
            ) )}
          </div>
          {grid.weeks.map( ( week ) => (
            <div key={ week.monday } className="grid items-center gap-1" style={ columns } role="group" aria-label={ `Week of ${ week.label }` }>
              <span className="whitespace-nowrap font-mono text-[10px] text-label">{week.label}</span>
              {week.cells.map( ( cell ) => {
                const day = slotLabel(
                  cell.at,
                  tz
                );
                const pressed = !custom && instant?.getTime() === cell.at.getTime();
                const short = day.split( " " )[ 1 ];

                return cell.state === "free" ? (
                  <button
                    key={ cell.at.toISOString() }
                    type="button"
                    aria-pressed={ pressed }
                    aria-label={ day }
                    title={ day }
                    onClick={ () => onChoose( free && cell.at.getTime() === free.getTime() ? {
                      kind: "next"
                    } : {
                      kind: "at",
                      at: cell.at.toISOString()
                    } ) }
                    className={ clsx(
                      CELL,
                      pressed ? ON : FREE
                    ) }
                  >
                    {short}
                  </button>
                ) : (
                  <span
                    key={ cell.at.toISOString() }
                    title={ cell.state === "taken" ? `${ day } — a post already goes out then (from any app on your Postiz)` : `${ day } — gone` }
                    className={ clsx(
                      CELL,
                      cell.state === "taken" ? "border-theme bg-hover text-label line-through" : "border-dashed border-theme text-label/60"
                    ) }
                  >
                    {short}
                  </span>
                );
              } )}
            </div>
          ) )}
          <div className="grid grid-cols-3 gap-1 pt-0.5" role="group" aria-label="Or">
            {( [
              [
                "custom",
                "Another time…"
              ],
              [
                "now",
                "Now"
              ],
              [
                "draft",
                "Draft"
              ]
            ] as const ).map( ( [
              k,
              label
            ] ) => {
              const pressed = k === "custom" ? custom : when.kind === k;

              return (
                <button
                  key={ k }
                  type="button"
                  aria-pressed={ pressed }
                  onClick={ () => pick( k ) }
                  className={ clsx(
                    CELL,
                    pressed ? ON : FREE
                  ) }
                >
                  {label}
                </button>
              );
            } )}
          </div>
          {custom && (
            <input
              type="datetime-local"
              aria-label="When it goes out, on this device's clock"
              className="rounded-lg border border-theme bg-background px-3 py-1.5 font-mono text-base text-foreground sm:text-xs"
              value={ instant ? localInput( instant ) : "" }
              onChange={ ( event ) => {
                const value = event.target.value ? new Date( event.target.value ) : null;

                if ( value && !Number.isNaN( value.getTime() ) ) {
                  onChoose( {
                    kind: "at",
                    at: value.toISOString(),
                    custom: true
                  } );
                }
              } }
            />
          )}
          <span className="font-mono text-[10px] text-label">
            {tz.replace(
              /_/g,
              " "
            )} time · struck out: a post already goes out
          </span>
        </div>
      )}
    </div>
  );
}
