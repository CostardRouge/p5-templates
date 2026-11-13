"use client";

import React, {
  useEffect, useState
} from "react";
import clsx from "clsx";

import {
  PROVIDER_GLYPH
} from "@/components/ChannelChip";
import {
  PROVIDER_LABEL, type Provider
} from "@/lib/postiz/client";
import type {
  AccountState, GallerySend, SendAccount, SendState
} from "@/lib/gallery/sends";

/** Each network's own colour — the only colour in the gallery besides the states. */
const MARK_BG: Record<Provider, string> = {
  instagram: "bg-[linear-gradient(135deg,#f58529,#dd2a7b_55%,#8134af)]",
  tiktok: "bg-[#111] shadow-[inset_-2px_-2px_0_#25f4ee,inset_2px_2px_0_#fe2c55]",
  youtube: "bg-[#ff0000]",
  threads: "bg-black ring-1 ring-white/30",
  x: "bg-black ring-1 ring-white/30",
  bluesky: "bg-[#1185fe]",
  other: "bg-neutral-500"
};

export const STATE_WORD: Record<AccountState, string> = {
  queue: "planned",
  published: "published",
  error: "failed",
  draft: "draft",
  unknown: "not listed"
};

export const SEND_WORD: Record<SendState, string> = {
  planned: "planned",
  published: "published",
  failed: "failed",
  draft: "draft",
  unknown: "sent"
};

/**
 * One account's network as a small square mark (the lab's): a failure ringed
 * red, a planned post with a blue dot at its corner, a published one plain.
 */
export function NetworkMark( {
  provider, state, size = "sm"
}: {
  provider: Provider;
  state?: AccountState;
  size?: "xs" | "sm";
} ) {
  return (
    <span
      title={ `${ PROVIDER_LABEL[ provider ] }${ state ? ` · ${ STATE_WORD[ state ] }` : "" }` }
      className={ clsx(
        "relative inline-grid shrink-0 place-items-center rounded-[5px] font-sans font-bold leading-none text-white",
        size === "xs" ? "h-3.5 w-3.5 text-[6.5px]" : "h-[18px] w-[18px] text-[8.5px]",
        MARK_BG[ provider ],
        state === "error" && "outline outline-2 outline-offset-1 outline-red-500",
        state === "queue" && "opacity-80"
      ) }
    >
      {PROVIDER_GLYPH[ provider ]}
      {state === "queue" && (
        <span aria-hidden="true" className={ clsx(
          "absolute rounded-full bg-blue-500 ring-[1.5px] ring-background",
          size === "xs" ? "-bottom-[2px] -right-[2px] h-1.5 w-1.5" : "-bottom-[3px] -right-[3px] h-2 w-2"
        ) } />
      )}
    </span>
  );
}

/** A send's accounts, each once (its worst state), as a row of marks. */
export function SendMarks( {
  send, size
}: {
  send: Pick<GallerySend, "accounts">;
  size?: "xs" | "sm";
} ) {
  const byChannel = new Map<string, SendAccount>();

  for ( const a of send.accounts ) {
    const seen = byChannel.get( a.channelId );

    if ( !seen || a.state === "error" || ( seen.state === "published" && a.state !== "published" ) ) {
      byChannel.set(
        a.channelId,
        a
      );
    }
  }

  return (
    <span className={ clsx(
      "inline-flex items-center",
      size === "xs" ? "gap-1.5" : "gap-[5px]"
    ) }>
      {[
        ...byChannel.values()
      ].map( ( a ) => (
        <NetworkMark key={ a.channelId } provider={ a.provider } state={ a.state } size={ size } />
      ) )}
    </span>
  );
}

const PILL: Record<SendState, string> = {
  planned: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  published: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  draft: "border-dashed border-theme text-label",
  unknown: "border-theme text-label"
};

/** A state as a small mono pill. */
export function StatePill( {
  state, label
}: {
  state: SendState;
  label?: string;
} ) {
  return (
    <span className={ clsx(
      "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-1.5 py-px font-mono text-[10px]",
      PILL[ state ]
    ) }>
      {label ?? SEND_WORD[ state ]}
    </span>
  );
}

/** An account's state as the pill's palette names it. */
export function accountPillState( state: AccountState ): SendState {
  return state === "queue" ? "planned" : state === "error" ? "failed" : state === "published" ? "published" : state === "draft" ? "draft" : "unknown";
}

/**
 * A picture that fills its frame: a kept piece's thumbnail (a Blob, its
 * object URL made and revoked in ONE effect — `gallery.md`'s trap), else the
 * catalogue's thumbnail by URL, else the frame alone. The frame is the
 * caller's, sized before anything loads, so nothing moves when it does.
 */
export function Vignette( {
  blob, src, className
}: {
  blob?: Blob | null;
  src?: string | null;
  className?: string;
} ) {
  const [
    url,
    setUrl
  ] = useState<string | null>( null );

  useEffect(
    () => {
      const next = blob ? URL.createObjectURL( blob ) : null;

      // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL's lifetime is this effect's
      setUrl( next );

      return () => {
        if ( next ) {
          URL.revokeObjectURL( next );
        }
      };
    },
    [
      blob
    ]
  );

  const shown = url ?? src ?? null;

  return shown
    ? <img src={ shown } alt="" loading="lazy" className={ clsx(
      "absolute inset-0 h-full w-full object-cover",
      className
    ) } />
    : <span aria-hidden="true" className={ clsx(
      "absolute inset-0 bg-hover/60",
      className
    ) } />;
}
