"use client";

import React, {
  useState
} from "react";
import clsx from "clsx";

import {
  PostizClient, PROVIDER_LABEL, providerOf, type PostizChannel
} from "@/lib/postiz/client";
import {
  formatCount, NO_POST_FIGURES
} from "@/lib/stats/metrics";
import {
  setStatsLevel, STATS_LEVELS
} from "@/lib/stats/settings";
import {
  MAX_SHIFT
} from "@/lib/stats/signal";
import {
  clearStats, SETTLED_DAYS
} from "@/lib/stats/store";
import {
  useStatsLevel, useStatsState
} from "./useStats";

const LEGEND = "font-mono text-[10.5px] uppercase tracking-wider text-label";

interface AccountLine {
  id: string;
  name: string;
  words: string;
}

/**
 * Publishing › Results: THE switch of statistics (off by default), folded
 * like the rhythm behind a one-line summary. Also what is kept, a way to
 * forget it, and — on demand only — what the Postiz gives for each account,
 * which is the quickest way to see whether a network gives anything at all.
 */
export default function ResultsSettings( {
  apiBase, apiKey, channels
}: {
  apiBase: string;
  apiKey: string;
  channels: readonly PostizChannel[];
} ) {
  const level = useStatsLevel();
  const state = useStatsState();
  const [
    accounts,
    setAccounts
  ] = useState<AccountLine[] | null>( null );
  const [
    asking,
    setAsking
  ] = useState( false );
  const [
    error,
    setError
  ] = useState<string | null>( null );
  const records = Object.values( state.posts );
  const settled = records.filter( ( r ) => r.settled ).length;
  const summary = level === "off"
    ? "off"
    : `${ STATS_LEVELS.find( ( l ) => l.id === level )?.label.toLowerCase() } · ${ records.length } ${ records.length === 1 ? "post" : "posts" } read, ${ settled } at ${ SETTLED_DAYS } days or more`;

  const readAccounts = async() => {
    const client = new PostizClient(
      apiBase,
      apiKey
    );
    const lines: AccountLine[] = [];

    setAsking( true );
    setError( null );

    try {
      for ( const channel of channels.filter( ( c ) => !c.disabled ) ) {
        const series = await client.channelAnalytics( channel.id );

        lines.push( {
          id: channel.id,
          name: `${ PROVIDER_LABEL[ providerOf( channel.identifier ) ] } · ${ channel.name }`,
          words: series.length
            ? series.map( ( s ) => `${ s.label } ${ formatCount( s.points[ s.points.length - 1 ].total ) }` ).join( " · " )
            : "your Postiz gave no figure for this account"
        } );
      }

      setAccounts( lines );
    } catch( caught ) {
      setError( caught instanceof Error ? caught.message : String( caught ) );
    } finally {
      setAsking( false );
    }
  };

  return (
    <details className="group border-b border-theme pb-3" data-stats-settings>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className={ LEGEND }>Results · what each post did</span>
          <span className="truncate font-mono text-[11px] text-label" data-stats-summary>{summary}</span>
        </span>
        <span className="text-xs text-label group-open:hidden">Change</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <div role="radiogroup" aria-label="Results" className="flex flex-col gap-1.5">
          {STATS_LEVELS.map( ( l ) => (
            <label
              key={ l.id }
              className={ clsx(
                "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs",
                level === l.id ? "border-foreground/60 bg-hover/40" : "border-border"
              ) }
            >
              <input
                type="radio"
                name="stats-level"
                value={ l.id }
                checked={ level === l.id }
                onChange={ () => setStatsLevel( l.id ) }
                data-stats-level={ l.id }
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{l.label}</span>
                <span className="text-label">{l.title}.</span>
              </span>
            </label>
          ) )}
        </div>
        <p className="m-0 text-[11.5px] leading-snug text-label">
          Off by default. On, this tab asks your Postiz for each post&apos;s figures — once from its first day, once between 2 and 7 days, once from {SETTLED_DAYS} days — and your Postiz asks each network with your account. A post is compared only by its reading at {SETTLED_DAYS} days or more, against the median of its own account; listening moves a proposal {MAX_SHIFT} places at most and says why on its line. The readings stay in this browser. Your Postiz reads no figure from {[
            ...new Set( channels.map( ( c ) => providerOf( c.identifier ) ).filter( ( p ) => NO_POST_FIGURES.has( p ) && p !== "other" ) )
          ].map( ( p ) => PROVIDER_LABEL[ p ] ).join( ", " ) || "Bluesky"}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={ level === "off" || asking }
            onClick={ () => void readAccounts() }
            title="One request per account, now. Shows what your Postiz gives for each — some networks give nothing."
            className="inline-flex min-h-8 items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover disabled:opacity-40"
            data-stats-accounts
          >
            {asking ? "Asking…" : "Read each account's last 7 days"}
          </button>
          <button
            type="button"
            disabled={ records.length === 0 }
            onClick={ () => {
              if ( window.confirm( `Forget the readings of ${ records.length } ${ records.length === 1 ? "post" : "posts" } kept in this browser? The readings at 2 and 7 days cannot be taken again.` ) ) {
                clearStats();
              }
            } }
            className="inline-flex min-h-8 items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover disabled:opacity-40"
          >
            Forget the readings
          </button>
        </div>
        {error && <p role="alert" className="m-0 text-xs text-red-500">{error}</p>}
        {accounts && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-stats-account-lines>
            {accounts.map( ( a ) => (
              <li key={ a.id } className="flex flex-col text-[11.5px]">
                <span className="text-foreground">{a.name}</span>
                <span className="font-mono text-[10.5px] text-label [overflow-wrap:anywhere]">{a.words}</span>
              </li>
            ) )}
          </ul>
        )}
      </div>
    </details>
  );
}
