"use client";

import clsx from "clsx";
import {
  Check
} from "lucide-react";

import {
  PROVIDER_LABEL, providerOf, type PostizChannel
} from "@/lib/postiz/client";

const PROVIDER_GLYPH = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  other: "··"
} as const;

/** An account as a chip: ticked when Export proposes it; one Sketchbook cannot fill is shown, not offered. */
export default function ChannelChip( {
  channel, checked, onToggle, disabledReason, note
}: {
  channel: PostizChannel;
  checked: boolean;
  onToggle: () => void;
  disabledReason?: string | null;
  /** The small mono word after the name; the network by default (`@username` as a collaborator). */
  note?: string;
} ) {
  const provider = providerOf( channel.identifier );
  const reason = disabledReason ?? ( channel.disabled ? "Disabled in your Postiz" : null );

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ checked && !reason }
      disabled={ Boolean( reason ) }
      title={ reason ?? `${ PROVIDER_LABEL[ provider ] } · ${ channel.name }` }
      onClick={ onToggle }
      className={ clsx(
        "inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3 text-xs text-foreground transition-colors disabled:opacity-40 pointer-coarse:min-h-11",
        checked && !reason ? "border-foreground ring-1 ring-foreground ring-inset" : "border-theme hover:border-foreground/60"
      ) }
    >
      {channel.picture
        ? <img src={ channel.picture } alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
        : <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hover font-mono text-[9px] font-semibold">{PROVIDER_GLYPH[ provider ]}</span>}
      <span className="truncate">{channel.name}</span>
      <span className="shrink-0 font-mono text-[10px] text-label">{note ?? PROVIDER_LABEL[ provider ].toLowerCase()}</span>
      <span
        aria-hidden="true"
        className={ clsx(
          "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
          checked && !reason ? "border-foreground bg-foreground text-background" : "border-theme"
        ) }
      >
        {checked && !reason && <Check className="h-2.5 w-2.5" strokeWidth={ 3 } />}
      </span>
    </button>
  );
}

