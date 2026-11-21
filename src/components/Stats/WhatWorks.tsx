"use client";

import React, {
  useEffect, useMemo, useState
} from "react";
import clsx from "clsx";

import type {
  GallerySend
} from "@/lib/gallery/sends";
import {
  PROVIDER_LABEL
} from "@/lib/postiz/client";
import type {
  PlanSketch
} from "@/lib/planner/planner";
import {
  groups, MIN_GROUP, MIN_USUAL, type GroupBy
} from "@/lib/stats/measure";
import {
  formatCount, formatTimes
} from "@/lib/stats/metrics";
import {
  heardPlan
} from "@/lib/stats/plan";
import {
  SETTLED_DAYS
} from "@/lib/stats/store";
import type {
  Stats
} from "./useStats";

const EYEBROW = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground/50";
const BY: readonly { id: GroupBy;
  label: string }[] = [
  {
    id: "pillar",
    label: "Pillar"
  },
  {
    id: "series",
    label: "Series"
  },
  {
    id: "slot",
    label: "Slot"
  }
];

/** The catalogue, asked for only when this opens — the Plan's own lazy chunk. */
function useCatalogue( wanted: boolean ): PlanSketch[] | null {
  const [
    catalogue,
    setCatalogue
  ] = useState<PlanSketch[] | null>( null );

  useEffect(
    () => {
      if ( !wanted ) {
        return;
      }

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
    [
      wanted
    ]
  );

  return catalogue;
}

/**
 * Under the Plan (lab 8, level 2): «What works» — the measured sends by
 * pillar, by series or by slot of the rhythm — and what the Plan is listening
 * to. Never a dashboard: one table, the figures a proposal can rest on. A
 * group under three posts says its count and nothing else.
 *
 * Off, it is one line saying so and where to turn it on. It is the page's
 * last block, so nothing above it moves when it fills.
 */
export default function WhatWorks( {
  stats, sends, now, onSettings
}: {
  stats: Stats;
  sends: readonly GallerySend[];
  now: number;
  /** Opens Publishing, where the switch is. */
  onSettings: () => void;
} ) {
  const on = stats.level !== "off";
  const catalogue = useCatalogue( on );
  const [
    by,
    setBy
  ] = useState<GroupBy>( "pillar" );
  const [
    channel,
    setChannel
  ] = useState<string>( "" );
  const heard = useMemo(
    () => !on || !catalogue ? null : heardPlan( {
      sends,
      catalogue,
      rhythm: stats.rhythm,
      now,
      level: stats.level,
      state: stats.state
    } ),
    [
      on,
      catalogue,
      sends,
      stats.rhythm,
      stats.level,
      stats.state,
      now
    ]
  );

  if ( !on ) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-foreground/55" data-stats-off>
        Results are off: the Plan is drawn from the calendar alone.
        <button type="button" onClick={ onSettings } className="border-0 bg-transparent p-0 font-mono text-[11px] text-foreground/70 underline underline-offset-2 hover:text-foreground">
          Turn them on in Publishing › Results
        </button>
      </p>
    );
  }

  const measured = heard?.heard.measured ?? null;
  const accounts = measured ? [
    ...measured.usual.values()
  ].map( ( u ) => {
    const named = measured.sends.flatMap( ( s ) => s.accounts ).find( ( a ) => a.channelId === u.channelId );

    return {
      ...u,
      name: named ? `${ PROVIDER_LABEL[ named.provider ] } · ${ named.name }` : u.channelId
    };
  } ) : [];
  const picked = accounts.find( ( a ) => a.channelId === channel ) ?? null;
  const rows = measured ? groups(
    measured.sends,
    by,
    picked?.channelId ?? null
  ) : [];
  const top = Math.max(
    0,
    ...rows.map( ( r ) => ( picked ? r.head : r.index ) ?? 0 )
  );
  const out = measured?.sends.length ?? 0;
  const count = heard?.listening.measured ?? 0;

  return (
    <section aria-label="What works" className="overflow-hidden rounded-xl border border-border" data-stats-works data-stats-measured={ count }>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-hover/50 px-3 py-2">
        <h2 className="m-0 text-sm font-semibold text-foreground">What works</h2>
        <span className="font-mono text-[11px] text-foreground/55">
          {measured === null
            ? "Reading the catalogue…"
            : `${ count } of ${ out } ${ out === 1 ? "send" : "sends" } measured at ${ SETTLED_DAYS } days or more${ stats.reading ? " · asking your Postiz…" : "" }`}
        </span>
        {!stats.reading && stats.readDue && (
          <button
            type="button"
            onClick={ stats.readDue }
            data-stats-read-due
            title="A few posts are read at a time, to ask your Postiz and the networks sparingly. The rest are read when the gallery opens next — or now."
            className="border-0 bg-transparent p-0 font-mono text-[11px] text-foreground/70 underline underline-offset-2 hover:text-foreground"
          >
            {stats.due} more to read · read now
          </button>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <select
            aria-label="Account"
            value={ picked?.channelId ?? "" }
            onChange={ ( event ) => setChannel( event.target.value ) }
            className="h-8 max-w-[14rem] rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-focus"
          >
            <option value="">Every account · × your usual</option>
            {accounts.map( ( a ) => <option key={ a.channelId } value={ a.channelId }>{a.name}</option> )}
          </select>
          <span role="radiogroup" aria-label="Group by" className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-hover/40 p-0.5">
            {BY.map( ( b ) => (
              <button
                key={ b.id }
                type="button"
                role="radio"
                aria-checked={ by === b.id }
                data-stats-by={ b.id }
                onClick={ () => setBy( b.id ) }
                className={ clsx(
                  "inline-flex h-full items-center rounded-md px-2.5 text-xs font-medium transition-colors",
                  by === b.id ? "bg-background text-foreground shadow-[0_0_0_1px_var(--color-border)]" : "text-foreground/60 hover:text-foreground"
                ) }
              >
                {b.label}
              </button>
            ) )}
          </span>
        </span>
      </div>

      {stats.problem && <p role="status" className="m-0 border-b border-border px-3 py-2 text-xs text-red-600 dark:text-red-400">{stats.problem}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-left text-xs">
          <thead>
            <tr className={ EYEBROW }>
              <th className="px-3 py-2 font-normal">{BY.find( ( b ) => b.id === by )?.label}</th>
              <th className="px-3 py-2 font-normal">Sends</th>
              <th className="px-3 py-2 font-normal">{picked ? `Median ${ picked.label.toLowerCase() }` : "Median × your usual"}</th>
              <th className="w-[30%] px-3 py-2 font-normal" aria-hidden />
              <th className="px-3 py-2 font-normal">{picked ? "Saves + shares / 100" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map( ( row ) => {
              const value = picked ? row.head : row.index;

              return (
                <tr key={ row.id } className="border-t border-border" data-stats-row={ row.id } data-stats-thin={ row.thin ? "true" : "false" }>
                  <td className={ clsx(
                    "px-3 py-2",
                    row.thin ? "text-foreground/50" : "font-medium text-foreground"
                  ) }
                  >
                    {row.label}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-foreground/70">{row.posts}</td>
                  {row.thin || value === null ? (
                    <td colSpan={ 3 } className="px-3 py-2 text-foreground/50">too few to say — {MIN_GROUP} sends at least</td>
                  ) : (
                    <>
                      <td className="px-3 py-2 tabular-nums text-foreground">{picked ? formatCount( value ) : formatTimes( value )}</td>
                      <td className="px-3 py-2">
                        <span className="block h-2 overflow-hidden rounded bg-hover">
                          <i className="block h-full rounded bg-foreground/60" style={ {
                            width: `${ top > 0 ? Math.round( 100 * value / top ) : 0 }%`
                          } }
                          />
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-foreground/70">{picked && row.rate !== null ? row.rate.toFixed( 1 ) : ""}</td>
                    </>
                  )}
                </tr>
              );
            } )}
            {measured !== null && rows.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={ 5 } className="px-3 py-4 text-foreground/55">
                  {out === 0
                    ? "No send of Sketchbook's is out yet, as far as this browser and your Postiz know."
                    : `Nothing is measured yet: a send counts once it was read ${ SETTLED_DAYS } days or more after it went out${ picked ? "" : `, on an account with ${ MIN_USUAL } such posts` }.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 border-t border-border px-3 py-2 text-[11.5px] text-foreground/70" data-stats-listening={ stats.level }>
        {heard?.listening.moving.map( ( line ) => <p key={ line } className="m-0">· {line}</p> )}
        <p className="m-0 text-foreground/55">
          {heard?.listening.note ?? ""}
          {" "}
          <button type="button" onClick={ onSettings } className="border-0 bg-transparent p-0 text-[11.5px] text-foreground/70 underline underline-offset-2 hover:text-foreground">
            Results settings
          </button>
        </p>
        <p className="m-0 font-mono text-[10px] text-foreground/45">
          Read from your Postiz and kept in this browser only. A pillar is the Plan&apos;s word for the sketch today; a series or recap reel is posted from the empty sketch and counts as one group. Posts made outside Sketchbook are not read.
        </p>
      </div>
    </section>
  );
}
