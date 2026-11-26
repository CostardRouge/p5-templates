"use client";

import {
  MenuItem
} from "@headlessui/react";
import clsx from "clsx";
import {
  Cloud, CloudOff, LogOut, RefreshCw
} from "lucide-react";

import {
  signIn, signOut
} from "@/lib/stockage/session";
import {
  forgetSync
} from "@/lib/stockage/sync";
import {
  runSync, useStockage
} from "@/lib/stockage/useStockage";

/** «Synced 2 min ago», for a line that is read at a glance. */
export function syncedAgo(
  at: number | null, now: number = Date.now()
): string {
  if ( at === null ) {
    return "not synced yet";
  }

  const minutes = Math.floor( ( now - at ) / 60_000 );

  if ( minutes < 1 ) {
    return "synced just now";
  }
  if ( minutes < 60 ) {
    return `synced ${ minutes } min ago`;
  }

  const hours = Math.floor( minutes / 60 );

  return hours < 24 ? `synced ${ hours } h ago` : `synced ${ Math.floor( hours / 24 ) } d ago`;
}

/**
 * Menu › Connections › Cloud: sign in with Sésame to keep the gallery, the
 * Plan and the studio's settings in the shared store, and find them on
 * another device (`src/lib/stockage/`). Hidden while `NEXT_PUBLIC_STOCKAGE`
 * is off. The syncs themselves are driven by `useStockageSync` in the menu
 * bar, which is mounted on every page; these lines exist only while it is open.
 */
export default function StockageMenuItems( {
  itemClass, mounted
}: { itemClass: string;
  mounted: boolean } ) {
  const {
    enabled, session, sync, reloadWanted, postizPending
  } = useStockage();

  if ( !enabled ) {
    return null;
  }

  if ( !mounted || !session ) {
    return (
      <MenuItem>
        {( {
          focus
        } ) => (
          <button
            type="button"
            onClick={ () => void signIn() }
            className={ clsx(
              itemClass,
              focus && "bg-hover"
            ) }
            title="Keep your gallery, Plan and settings in your storage, and find them on your other devices. The Postiz key stays in each browser."
          >
            <CloudOff className="h-4 w-4 text-foreground/70" />
            <span className="flex-1 text-left">Cloud</span>
            <span className="font-mono text-[10px] text-label">sign in</span>
          </button>
        )}
      </MenuItem>
    );
  }

  const status = sync.phase === "syncing"
    ? "syncing…"
    : sync.phase === "error" ? "failed" : syncedAgo( sync.at );

  return (
    <>
      <MenuItem>
        {( {
          focus
        } ) => (
          <button
            type="button"
            onClick={ ( event ) => {
              event.preventDefault();
              if ( reloadWanted ) {
                window.location.reload();
              } else {
                void runSync();
              }
            } }
            disabled={ sync.phase === "syncing" }
            className={ clsx(
              itemClass,
              focus && "bg-hover"
            ) }
            title={ `Signed in with Sésame${ session.name ? ` as ${ session.name }` : "" }. Click to sync now.` }
            data-stockage-state={ sync.phase }
          >
            {sync.phase === "syncing"
              ? <RefreshCw className="h-4 w-4 animate-spin text-foreground/70 motion-reduce:animate-none" />
              : <Cloud className="h-4 w-4 text-foreground/70" />}
            <span className="flex-1 text-left">Cloud</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-label">
              {sync.phase === "idle" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              {status}
            </span>
          </button>
        )}
      </MenuItem>
      {sync.phase === "error" && (
        <p className="px-3 pb-2 text-xs text-foreground/60">{sync.message}</p>
      )}
      {reloadWanted && (
        <p className="px-3 pb-2 text-xs text-foreground/60">Settings from another device arrived: click Cloud to reload.</p>
      )}
      {postizPending && (
        <p className="px-3 pb-2 text-xs text-foreground/60">Your Postiz accounts arrived: paste the API key in Publishing to use them here.</p>
      )}
      <MenuItem>
        {( {
          focus
        } ) => (
          <button
            type="button"
            onClick={ () => {
              forgetSync();
              void signOut();
            } }
            className={ clsx(
              itemClass,
              focus && "bg-hover"
            ) }
            title="This browser stops syncing. Your gallery stays here and in your storage."
          >
            <LogOut className="h-4 w-4 text-foreground/70" />
            <span className="flex-1 text-left">Sign out of the cloud</span>
          </button>
        )}
      </MenuItem>
    </>
  );
}
