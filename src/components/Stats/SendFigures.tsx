"use client";

import React from "react";

import {
  PROVIDER_LABEL
} from "@/lib/postiz/client";
import {
  MIN_USUAL, type MeasuredAccount, type MeasuredSend, type Usual
} from "@/lib/stats/measure";
import {
  formatCount, formatTimes, headline, headlineWord, keepRate
} from "@/lib/stats/metrics";
import {
  SETTLED_DAYS
} from "@/lib/stats/store";

const days = ( n: number ) => n < 1 ? "under a day" : `${ Math.round( n * 10 ) / 10 } ${ n === 1 ? "day" : "days" }`;

function readOn(
  at: number, tz: string
): string {
  return new Date( at ).toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz
    }
  );
}

const EMPTY_WORDS: Record<Exclude<MeasuredAccount[ "stats" ], "figures">, ( network: string ) => string> = {
  unread: () => "Not read yet — a post is read from its first day.",
  none: () => "Your Postiz had no figure for this post when asked.",
  missing: ( network ) => `Postiz lost this post's id on ${ network }: no figure until it is matched in Postiz.`,
  "no-network": ( network ) => `Postiz reads no figure from ${ network }.`
};

function AccountFigures( {
  account, usual, tz, several
}: {
  account: MeasuredAccount;
  usual: Usual | undefined;
  tz: string;
  several: boolean;
} ) {
  const network = PROVIDER_LABEL[ account.provider ];
  const who = several ? `${ network } · ${ account.name }` : network;

  if ( account.stats !== "figures" || !account.shown ) {
    return (
      <li className="flex flex-col gap-0.5 px-3 py-2" data-stats-account={ account.postId } data-stats-state={ account.stats }>
        <span className="font-mono text-[10.5px] text-label">{who}</span>
        <span className="text-[11.5px] text-label">{EMPTY_WORDS[ account.stats === "figures" ? "unread" : account.stats ]( network )}</span>
      </li>
    );
  }

  const shown = account.shown;
  const head = headline( shown.figures );
  const rate = keepRate( shown.figures );
  const rest = shown.figures.filter( ( f ) => f !== head );

  return (
    <li className="flex flex-col gap-1 px-3 py-2" data-stats-account={ account.postId } data-stats-state={ account.settled ? "settled" : "early" }>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[10.5px] text-label">{who}</span>
        {head && (
          <span className="text-[15px] font-semibold tabular-nums text-foreground" data-stats-headline>
            {formatCount( head.value )}
            <span className="ml-1 text-[11px] font-normal text-label">{headlineWord( head )}</span>
          </span>
        )}
        {account.index !== null ? (
          <span
            className="rounded-full border border-foreground/60 px-1.5 py-px font-mono text-[10px] font-semibold text-foreground"
            title={ usual ? `Against the median ${ usual.label.toLowerCase() } of this account's ${ usual.posts } posts read at ${ SETTLED_DAYS } days or more: ${ formatCount( usual.value ?? 0 ) }` : undefined }
            data-stats-index
          >
            {formatTimes( account.index )} your usual
          </span>
        ) : !account.settled ? (
          <span className="rounded-full border border-dashed border-border px-1.5 py-px font-mono text-[10px] text-label">
            at {days( shown.ageDays )} · settles at {SETTLED_DAYS}
          </span>
        ) : head && (
          <span
            className="rounded-full border border-dashed border-border px-1.5 py-px font-mono text-[10px] text-label"
            title={ `«× your usual» needs ${ MIN_USUAL } posts of this account read at ${ SETTLED_DAYS } days or more` }
          >
            {usual?.posts ?? 0} of {MIN_USUAL} posts for «your usual»
          </span>
        )}
      </span>
      <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] tabular-nums text-label">
        {rest.map( ( f ) => <span key={ f.label }>{f.label} {formatCount( f.value )}</span> )}
        {rate && <span>· {rate.value.toFixed( 1 )} {rate.words}</span>}
      </span>
      <span className="font-mono text-[10px] text-label/80">
        read {readOn(
          shown.at,
          tz
        )}, {days( shown.ageDays )} after it went out
      </span>
    </li>
  );
}

/**
 * A send's figures in the sketch's sheet (lab 8, level 1): for each account
 * ONE number in large — how many it reached, in the network's own word — the
 * rest small, exactly as given, with when it was read and at what age. A post
 * that has not settled says so instead of being compared; a network that
 * gives nothing says that.
 */
export default function SendFigures( {
  send, usual, tz, reading, problem, onAgain
}: {
  send: MeasuredSend;
  usual: ReadonlyMap<string, Usual>;
  tz: string;
  reading: boolean;
  problem: string | null;
  onAgain: ( () => void ) | null;
} ) {
  const networks = send.accounts.map( ( a ) => a.provider );

  return (
    <div className="border-t border-border bg-hover/20" data-stats-send={ send.key }>
      <p className="m-0 flex items-center justify-between gap-2 px-3 pt-2 font-mono text-[10px] uppercase tracking-wider text-label">
        <span>Figures · from your Postiz</span>
        {onAgain && (
          <button
            type="button"
            disabled={ reading }
            onClick={ onAgain }
            title="Ask your Postiz for this send's figures now. It asks each network with your account — sparingly."
            className="border-0 bg-transparent p-0 font-mono text-[10px] normal-case tracking-normal text-label underline underline-offset-2 hover:text-foreground disabled:opacity-50"
          >
            {reading ? "Reading…" : "Read again"}
          </button>
        )}
      </p>
      <ul className="m-0 list-none divide-y divide-border/60 p-0">
        {send.accounts.map( ( account ) => (
          <AccountFigures
            key={ account.postId }
            account={ account }
            usual={ usual.get( account.channelId ) }
            tz={ tz }
            several={ networks.filter( ( p ) => p === account.provider ).length > 1 }
          />
        ) )}
      </ul>
      {problem && <p role="status" className="m-0 border-t border-border/60 px-3 py-1.5 text-[11px] text-red-600 dark:text-red-400">{problem}</p>}
    </div>
  );
}
