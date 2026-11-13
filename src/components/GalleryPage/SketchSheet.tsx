"use client";

import React, {
  useEffect, useRef, useState
} from "react";
import clsx from "clsx";
import {
  ExternalLink, X
} from "lucide-react";

import {
  accountLabel, failedAccounts, firstSentence, sendState, type GallerySend, type SendAccount
} from "@/lib/gallery/sends";
import type {
  GalleryEntry
} from "@/lib/gallery/types";
import {
  failureHint, PROVIDER_LABEL
} from "@/lib/postiz/client";
import {
  slotLabel
} from "@/lib/postiz/rhythm";
import {
  formatSketchTitle
} from "@/lib/seo";
import {
  catalogueThumbnail, type SheetTarget
} from "./items";
import {
  accountPillState, NetworkMark, StatePill, STATE_WORD, Vignette
} from "./marks";

const KIND_WORD: Record<GallerySend[ "kind" ], string> = {
  reel: "Reel",
  post: "Post",
  carousel: "Carousel",
  story: "Story"
};

const BUTTON = "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground no-underline transition-colors hover:bg-hover disabled:opacity-40 pointer-coarse:min-h-11";
const INK = "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background no-underline transition-opacity hover:opacity-85 disabled:opacity-40 pointer-coarse:min-h-11";

/** One failed account: Postiz's first sentence, then what to do about it. */
function Failure( {
  account
}: {
  account: SendAccount;
} ) {
  const [
    raw,
    setRaw
  ] = useState( false );
  const first = firstSentence( account.error );
  const hint = failureHint( account.error );

  return (
    <span className="col-span-2 col-start-2 flex flex-col gap-0.5 text-[11.5px] leading-snug">
      <span className="text-red-600 dark:text-red-400">{first}</span>
      {hint && <span className="text-foreground">{hint}</span>}
      {account.error && account.error.trim() !== first.trim() && (
        <button
          type="button"
          aria-expanded={ raw }
          onClick={ () => setRaw( ( r ) => !r ) }
          className="self-start border-0 bg-transparent p-0 font-mono text-[10px] text-label underline"
        >
          {raw ? "Hide what Postiz said" : "What Postiz said"}
        </button>
      )}
      {raw && <span className="whitespace-pre-wrap break-words font-mono text-[10px] text-label">{account.error}</span>}
    </span>
  );
}

/** One send: when, its state, each account with its link or its failure, and what can be done. */
function SendBlock( {
  send, tz, postizUrl, focused, onTakeBack, onSendAgain
}: {
  send: GallerySend;
  tz: string;
  postizUrl: string | null;
  focused: boolean;
  onTakeBack: ( ( send: GallerySend, postIds: string[] ) => Promise<void> ) | null;
  onSendAgain: ( ( send: GallerySend ) => void ) | null;
} ) {
  const state = sendState( send );
  const [
    confirming,
    setConfirming
  ] = useState( false );
  const [
    busy,
    setBusy
  ] = useState( false );
  const [
    error,
    setError
  ] = useState<string | null>( null );
  // What can still be taken back in Postiz: everything listed and not out.
  const live = send.accounts.filter( ( a ) => a.state === "queue" || a.state === "draft" || a.state === "error" );
  const failed = failedAccounts( send );
  const distinct = send.accounts.filter( (
    a, i, all
  ) => all.findIndex( ( b ) => b.channelId === a.channelId ) === i );
  const when = send.target === "draft"
    ? "Draft in Postiz"
    : slotLabel(
      new Date( send.at ),
      tz
    );
  const ref = useRef<HTMLDivElement | null>( null );

  useEffect(
    () => {
      if ( focused ) {
        ref.current?.scrollIntoView( {
          block: "nearest"
        } );
      }
    },
    [
      focused
    ]
  );

  const takeBack = async() => {
    if ( !onTakeBack ) {
      return;
    }

    setBusy( true );
    setError( null );

    try {
      await onTakeBack(
        send,
        live.map( ( a ) => a.postId )
      );
      setConfirming( false );
    } catch( caught ) {
      setError( caught instanceof Error ? caught.message : String( caught ) );
    } finally {
      setBusy( false );
    }
  };

  return (
    <div
      ref={ ref }
      data-send={ send.key }
      className={ clsx(
        "overflow-hidden rounded-xl border",
        focused ? "border-foreground/50" : "border-border"
      ) }
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border bg-hover/40 px-3 py-2 text-xs">
        <span className="font-mono text-[11px] tabular-nums text-foreground">{when}</span>
        <StatePill state={ state } />
        <span className="text-label">{KIND_WORD[ send.kind ]} · {send.variantName}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {send.accounts.map( ( a ) => (
          <li key={ a.postId } className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 border-b border-border px-3 py-2 text-[12.5px] last:border-b-0">
            <NetworkMark provider={ a.provider } state={ a.state } />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-foreground">{a.name}</span>
              <span className="font-mono text-[10.5px] text-label">
                {PROVIDER_LABEL[ a.provider ]}{a.story ? " · story" : ""}
              </span>
            </span>
            {a.url ? (
              <a href={ a.url } target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-foreground underline-offset-2 hover:underline">
                View
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <StatePill state={ accountPillState( a.state ) } label={ STATE_WORD[ a.state ] } />
            )}
            {a.state === "error" && <Failure account={ a } />}
          </li>
        ) )}
      </ul>
      {confirming ? (
        <div className="flex flex-col gap-2 border-t border-border bg-red-500/5 px-3 py-2.5 text-xs text-foreground">
          <span>
            {live.length > 1 ? `Delete its ${ live.length } posts that are not out in your Postiz?` : "Delete it in your Postiz?"}
            {live.some( ( a ) => a.state === "queue" ) ? " It will not go out." : ""}
          </span>
          <span className="flex gap-2">
            <button type="button" disabled={ busy } onClick={ () => void takeBack() } className={ `${ BUTTON } text-red-600` }>
              {busy ? "Taking back…" : "Take back"}
            </button>
            <button type="button" disabled={ busy } onClick={ () => setConfirming( false ) } className={ BUTTON }>
              Keep {live.length > 1 ? "them" : "it"}
            </button>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
          {failed.length > 0 && onSendAgain && (
            <button type="button" className={ INK } onClick={ () => onSendAgain( send ) } title="Opens the piece on Export › Publish, only the accounts that failed ticked">
              Send again to {failed.map( ( a ) => accountLabel(
                a,
                distinct
              ) ).join( ", " )}
            </button>
          )}
          {live.length > 0 && onTakeBack && (
            <button type="button" className={ BUTTON } onClick={ () => setConfirming( true ) }>
              {!live.some( ( a ) => a.state === "queue" || a.state === "draft" )
                ? `Delete the failed post${ live.length > 1 ? "s" : "" }`
                : `Take back${ live.length < distinct.length ? " what is not out" : "" }`}
            </button>
          )}
          {postizUrl && (
            <a href={ postizUrl } target="_blank" rel="noreferrer" className={ BUTTON }>
              Open in Postiz
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      {error && <p role="alert" className="m-0 border-t border-border px-3 py-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/**
 * The sketch's sheet (lab 3), over every view: the sketch, every send of it
 * with each account, its state, *View ↗* (Postiz's `releaseURL`), a failure's
 * first sentence and what to do, *Take back* for what is not out, *Open in
 * Postiz* — then the pieces kept of it, and *Open the sketch*. A right-hand
 * sheet on a wide screen, the whole screen on a phone.
 */
export default function SketchSheet( {
  target, entries, sends, tz, postizUrl, onClose, onOpenPiece, onOpenSketch, onTakeBack, onSendAgain
}: {
  target: SheetTarget;
  entries: readonly GalleryEntry[];
  sends: readonly GallerySend[];
  tz: string;
  postizUrl: string | null;
  onClose: () => void;
  onOpenPiece: ( entry: GalleryEntry ) => void;
  onOpenSketch: ( sketchKey: string ) => void;
  onTakeBack: ( ( send: GallerySend, postIds: string[] ) => Promise<void> ) | null;
  onSendAgain: ( ( send: GallerySend ) => void ) | null;
} ) {
  const pieces = entries.filter( ( e ) => `${ e.engine }/${ e.name }` === target.sketchKey );
  const mine = sends.filter( ( s ) => s.sketchKey === target.sketchKey );
  const focusedPiece = pieces.find( ( e ) => e.id === target.pieceId ) ?? pieces[ 0 ] ?? null;
  const name = target.sketchKey.split( "/" )[ 1 ] ?? target.sketchKey;
  const title = formatSketchTitle( name );
  const closeRef = useRef<HTMLButtonElement | null>( null );

  useEffect(
    () => {
      const previous = document.activeElement as HTMLElement | null;
      const onKey = ( event: KeyboardEvent ) => {
        if ( event.key === "Escape" ) {
          onClose();
        }
      };

      closeRef.current?.focus();
      document.addEventListener(
        "keydown",
        onKey
      );

      return () => {
        document.removeEventListener(
          "keydown",
          onKey
        );
        previous?.focus?.();
      };
    },
    [
      onClose
    ]
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-black/35"
      onClick={ ( event ) => {
        if ( event.target === event.currentTarget ) {
          onClose();
        }
      } }
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ title }
        data-sketch-sheet={ target.sketchKey }
        className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-background shadow-2xl sm:w-[460px] motion-safe:animate-sheet-in"
      >
        <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <span className="relative block aspect-[4/5] w-14 overflow-hidden rounded-lg bg-hover/60">
            <Vignette blob={ focusedPiece?.thumbnail ?? null } src={ catalogueThumbnail( target.sketchKey ) } />
          </span>
          <span className="min-w-0">
            <b className="block truncate text-[15px] font-semibold text-foreground">{focusedPiece?.title || title}</b>
            <span className="block truncate font-mono text-[11px] text-label">{target.sketchKey}</span>
          </span>
          <button
            ref={ closeRef }
            type="button"
            onClick={ onClose }
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background text-foreground hover:bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ INK }
              onClick={ () => focusedPiece ? onOpenPiece( focusedPiece ) : onOpenSketch( target.sketchKey ) }
              title={ focusedPiece ? "Opens the sketch with this piece's options" : "Opens the sketch with its defaults" }
            >
              Open the sketch
            </button>
          </div>

          <p className="m-0 font-mono text-[10.5px] uppercase tracking-wider text-label">Sends · {mine.length}</p>
          {mine.length ? mine.map( ( send ) => (
            <SendBlock
              key={ send.key }
              send={ send }
              tz={ tz }
              postizUrl={ postizUrl }
              focused={ send.key === target.sendKey }
              onTakeBack={ onTakeBack }
              onSendAgain={ onSendAgain }
            />
          ) ) : (
            <p className="m-0 text-xs text-label">Never posted from this browser. Open the sketch, then Export › Publish.</p>
          )}

          <p className="m-0 font-mono text-[10.5px] uppercase tracking-wider text-label">Pieces kept · {pieces.length}</p>
          {pieces.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
              {pieces.map( ( piece ) => (
                <button
                  key={ piece.id }
                  type="button"
                  onClick={ () => onOpenPiece( piece ) }
                  title={ `Open ${ piece.title || title } (${ new Date( piece.at ).toLocaleDateString() }) in the studio` }
                  className={ clsx(
                    "relative overflow-hidden rounded-md bg-hover/60 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus",
                    piece.id === focusedPiece?.id && "ring-2 ring-foreground"
                  ) }
                  style={ {
                    aspectRatio: `${ piece.width } / ${ piece.height }`
                  } }
                >
                  <Vignette blob={ piece.thumbnail } />
                </button>
              ) )}
            </div>
          ) : (
            <p className="m-0 text-xs text-label">No piece of it is kept in this browser.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
