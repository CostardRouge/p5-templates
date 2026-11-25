"use client";

import clsx from "clsx";

import {
  PROVIDER_GLYPH
} from "@/components/ChannelChip";
import {
  FormatDot
} from "@/components/RhythmDots";
import {
  FORMAT_LABEL
} from "@/lib/postiz/accountRhythm";
import {
  providerOf
} from "@/lib/postiz/client";
import {
  connAccounts, routeWords, sendAt, shortNamer, type RhythmSource
} from "@/lib/postiz/slotAsks";

/**
 * What the rhythm's slot at `at` asks for (lab 10's canvas ② and ⑥):
 * `inline` — one mono line per group of accounts taking the same formats
 * (a Plan line); `list` — one row per account with its format (the Plan's
 * sheet, Export's When card). Nothing when `at` is not on the rhythm.
 */
export default function SlotAsks( {
  conn, at, variant = "inline", className
}: {
  conn: RhythmSource;
  at: Date;
  variant?: "inline" | "list";
  className?: string;
} ) {
  const send = sendAt(
    connAccounts( conn ),
    at,
    conn.rhythm.timeZone
  );

  if ( !send ) {
    return null;
  }
  const nameOf = shortNamer( conn.channels );

  if ( variant === "inline" ) {
    return (
      <span className={ clsx(
        "flex min-w-0 flex-col gap-0.5",
        className
      ) } data-slot-asks
      >
        {send.routes.map( ( r ) => (
          <span key={ r.formats.join( "+" ) + r.ids.join( "," ) } className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-foreground/70">
            <FormatDot format={ r.formats[ 0 ] } />
            <span className="min-w-0 truncate">{routeWords(
              r,
              nameOf
            )}</span>
          </span>
        ) )}
      </span>
    );
  }

  return (
    <ul className={ clsx(
      "m-0 flex list-none flex-col gap-1 p-0",
      className
    ) } data-slot-asks
    >
      {send.routes.flatMap( ( r ) => r.ids.map( ( id ) => {
        const channel = conn.channels.find( ( c ) => c.id === id );

        return (
          <li key={ id } className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 text-xs">
            <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-hover font-mono text-[8px] font-semibold">
              {channel ? PROVIDER_GLYPH[ providerOf( channel.identifier ) ] : "··"}
            </span>
            <span className="min-w-0 truncate text-foreground">{channel?.name ?? id}</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-theme px-1.5 font-mono text-[11px] leading-5 text-foreground">
              <FormatDot format={ r.formats[ 0 ] } />
              {r.formats.map( ( f ) => FORMAT_LABEL[ f ] ).join( " + " )}
            </span>
          </li>
        );
      } ) )}
    </ul>
  );
}
