"use client";

import {
  Dialog, DialogPanel, DialogTitle
} from "@headlessui/react";
import clsx from "clsx";
import {
  Check, ChevronDown, Copy, Send, X
} from "lucide-react";
import type React from "react";
import {
  useEffect, useState
} from "react";

import ChannelChip from "@/components/ChannelChip";
import {
  OTHER_PROVIDER, PostizClient, findApi, providerOf
} from "@/lib/postiz/client";
import {
  DEFAULT_RHYTHM
} from "@/lib/postiz/rhythm";
import {
  DEFAULT_PHRASES, type Phrase
} from "@/lib/postiz/pills";
import {
  cleanHandle, forgetPostiz, initialDefaults, putPostiz, updatePostiz, type PostizConnection
} from "@/lib/postiz/store";
import {
  usePostiz
} from "@/lib/postiz/usePostiz";
import ResultsSettings from "@/components/Stats/ResultsSettings";
import RhythmDialog from "@/components/RhythmDialog";
import {
  RhythmWeekDots
} from "@/components/RhythmDots";
import {
  connAccounts
} from "@/lib/postiz/slotAsks";

/**
 * Menu › Publishing: the person's own Postiz — its address and the API key
 * they paste, the accounts Export ticks by default, the collaborator it
 * proposes, and their rhythm. The frame is the agent guide's (a live status,
 * three steps that tick themselves off, "Good to know"), so the two
 * connections read as one family. Lab 1 §5; decisions in
 * `docs/memory/publishing.md`.
 *
 * Requests, all from this tab to the Postiz typed here: `/is-connected` and
 * `/integrations` on Connect, `/integrations` again each time this opens.
 */

type Health = "off" | "asking" | "ok" | "refused" | "down";

const OFFICIAL_ORIGIN = "https://p5.steeve.website";

const INPUT = "w-full rounded-lg border border-theme bg-background px-3 py-2 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs";
const GHOST = "inline-flex items-center gap-1.5 rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40";
const INK = "inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40";
const LEGEND = "m-0 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-label";

function Hint( {
  children
}: { children: React.ReactNode } ) {
  return <p className="m-0 text-sm leading-relaxed text-label">{children}</p>;
}

function Step( {
  n, title, done = false, hot = false, children
}: {
  n: number;
  title: string;
  done?: boolean;
  hot?: boolean;
  children: React.ReactNode;
} ) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-3">
      <span
        aria-hidden="true"
        className={ clsx(
          "grid h-8 w-8 place-items-center rounded-full border font-mono text-sm font-semibold",
          done ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500" : hot ? "border-red-500/60 text-red-500" : "border-theme text-foreground"
        ) }
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="flex min-w-0 flex-col gap-2.5 border-b border-theme pb-5">
        <h3 className="m-0 mt-1 text-base font-medium text-foreground">
          {title}
          {done && <span className="sr-only"> — done</span>}
        </h3>
        {children}
      </div>
    </li>
  );
}

function Faq( {
  q, children
}: {
  q: string;
  children: React.ReactNode;
} ) {
  return (
    <details className="group border-b border-theme py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
        {q}
        <ChevronDown className="h-4 w-4 shrink-0 text-label transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-label">{children}</div>
    </details>
  );
}

/**
 * The rhythm in one line (lab 10): it is set account by account in its own
 * dialog, opened from here or from the gallery's Plan — Publishing no longer
 * holds an editor, which kept this step short.
 */
function RhythmRow( {
  conn
}: {
  conn: PostizConnection;
} ) {
  const [
    open,
    setOpen
  ] = useState( false );
  const accounts = connAccounts( conn );
  const sends = conn.rhythm.slots.length;
  const busy = Object.values( accounts ).filter( ( a ) => a.slots.length ).length;

  return (
    <div className="flex items-center gap-3 border-b border-theme pb-3">
      <RhythmWeekDots accounts={ accounts } />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={ LEGEND }>Your rhythm</span>
        <span className="truncate font-mono text-[11px] text-label">
          {sends} send{sends === 1 ? "" : "s"} a week on {busy} account{busy === 1 ? "" : "s"} · {conn.rhythm.timeZone}
        </span>
      </span>
      <button type="button" className={ GHOST } onClick={ () => setOpen( true ) }>Edit</button>
      <RhythmDialog open={ open } onClose={ () => setOpen( false ) } />
    </div>
  );
}

/**
 * His phrases (the «My words» pills): written once here, used in any caption.
 * Folded like the rhythm, behind a one-line summary of their names. Day 1 of
 * the «Day N» pill sits with them.
 */
function PhrasesEditor( {
  phrases, dayStart, onChange
}: {
  phrases: Phrase[];
  dayStart: string | null;
  onChange: ( patch: { phrases?: Phrase[];
    dayStart?: string | null } ) => void;
} ) {
  const control = "min-w-0 rounded-lg border border-theme bg-background px-2 py-1.5 text-base text-foreground focus:border-foreground focus:outline-hidden sm:text-xs";
  const set = (
    i: number, patch: Partial<Phrase>
  ) => onChange( {
    phrases: phrases.map( (
      p, j
    ) => j === i ? {
      ...p,
      ...patch
    } : p )
  } );

  return (
    <details className="group border-b border-theme pb-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={ LEGEND }>Your phrases · for any caption</span>
          <span className="truncate font-mono text-[11px] text-label">{phrases.map( ( p ) => p.name ).join( " · " ) || "none"}{dayStart ? ` · day 1 ${ dayStart }` : ""}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-label transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {phrases.map( (
            phrase, i
          ) => (
            <li key={ phrase.id } className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-1.5">
              <input
                value={ phrase.name }
                aria-label="Phrase name"
                maxLength={ 40 }
                onChange={ ( e ) => set(
                  i,
                  {
                    name: e.target.value
                  }
                ) }
                className={ control }
              />
              <input
                value={ phrase.text }
                aria-label={ `${ phrase.name } text` }
                maxLength={ 500 }
                onChange={ ( e ) => set(
                  i,
                  {
                    text: e.target.value
                  }
                ) }
                className={ control }
              />
              <button
                type="button"
                aria-label={ `Remove ${ phrase.name }` }
                onClick={ () => onChange( {
                  phrases: phrases.filter( (
                    _, j
                  ) => j !== i )
                } ) }
                className="rounded-md p-1.5 text-label hover:bg-hover hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ) )}
        </ul>
        <button
          type="button"
          disabled={ phrases.length >= 24 }
          onClick={ () => onChange( {
            phrases: [
              ...phrases,
              {
                id: `p${ Date.now().toString( 36 ) }`,
                name: "New phrase",
                text: ""
              }
            ]
          } ) }
          className="self-start text-xs text-label underline underline-offset-2 hover:text-foreground disabled:opacity-40"
        >
          + A phrase
        </button>
        <p className="m-0 text-[11px] text-label">
          «Link in bio» is what Instagram and TikTok say in place of the sketch&apos;s link. A phrase of hashtags only is counted with the other hashtags.
        </p>
        <label className="flex items-center gap-2 text-xs text-foreground">
          Day 1 of the «Day N» pill
          <input
            type="date"
            value={ dayStart ?? "" }
            onChange={ ( e ) => onChange( {
              dayStart: e.target.value || null
            } ) }
            className={ control }
          />
        </label>
      </div>
    </details>
  );
}

export default function PublishingDialog( {
  open, onClose
}: {
  open: boolean;
  onClose: () => void;
} ) {
  const conn = usePostiz();
  const [
    health,
    setHealth
  ] = useState<Health>( conn ? "asking" : "off" );
  const [
    message,
    setMessage
  ] = useState<string | null>( null );
  const [
    address,
    setAddress
  ] = useState( "" );
  const [
    key,
    setKey
  ] = useState( "" );
  const [
    confirmForget,
    setConfirmForget
  ] = useState( false );
  const [
    copied,
    setCopied
  ] = useState( false );
  const [
    origin
  ] = useState( () => typeof window === "undefined" ? OFFICIAL_ORIGIN : window.location.origin );

  // Opening re-asks whether the kept Postiz still answers, and refreshes its accounts.
  useEffect(
    () => {
      if ( !open || !conn ) {
        return;
      }

      // Mounted per opening, so it starts "asking" already.
      let alive = true;

      new PostizClient(
        conn.apiBase,
        conn.apiKey
      ).channels()
        .then( ( channels ) => {
          if ( !alive ) {
            return;
          }

          setHealth( "ok" );
          setMessage( null );
          updatePostiz( {
            channels
          } );
        } )
        .catch( ( error: unknown ) => {
          if ( !alive ) {
            return;
          }

          const text = error instanceof Error ? error.message : String( error );

          setHealth( /API key/.test( text ) ? "refused" : "down" );
          setMessage( text );
        } );

      return () => {
        alive = false;
      };
    },
    // Re-asked when another Postiz is connected or the dialog opens, not on every edit of the rhythm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      open,
      conn?.apiBase,
      conn?.apiKey
    ]
  );

  useEffect(
    () => {
      if ( !copied ) {
        return;
      }

      const timer = window.setTimeout(
        () => setCopied( false ),
        1600
      );

      return () => window.clearTimeout( timer );
    },
    [
      copied
    ]
  );

  const connect = async() => {
    setHealth( "asking" );
    setMessage( null );

    try {
      const client = await findApi(
        address,
        key.trim()
      );
      const channels = await client.channels();

      // A new key for the same Postiz keeps what was chosen; another Postiz starts over.
      const same = conn && conn.apiBase === client.apiBase;

      putPostiz( {
        apiBase: client.apiBase,
        apiKey: key.trim(),
        channels,
        defaultChannelIds: same ? conn.defaultChannelIds : initialDefaults( channels ),
        collaborator: same ? conn.collaborator : "",
        handles: same ? conn.handles : {},
        usual: same ? conn.usual : {},
        rhythm: same ? conn.rhythm : DEFAULT_RHYTHM,
        // His phrases are his words, whatever Postiz they go through.
        phrases: conn?.phrases ?? DEFAULT_PHRASES.map( ( p ) => ( {
          ...p
        } ) ),
        dayStart: conn?.dayStart ?? null,
        connectedAt: Date.now()
      } );
      setKey( "" );
      setHealth( "ok" );
    } catch( error ) {
      const text = error instanceof Error ? error.message : String( error );

      setHealth( /API key/.test( text ) ? "refused" : "down" );
      setMessage( text );
    }
  };

  const connected = Boolean( conn ) && health !== "refused";
  const ok = Boolean( conn ) && health === "ok";
  const ready = address.trim().length > 0 && key.trim().length > 0;
  const host = conn ? new URL( conn.apiBase ).host : null;
  const corsDone = ok || health === "refused";
  const defaults = new Set( conn?.defaultChannelIds ?? [] );
  const instagramAccounts = ( conn?.channels ?? [] ).filter( ( c ) => !c.disabled && providerOf( c.identifier ) === "instagram" );
  const stateWord = {
    off: "Not connected",
    asking: "Asking…",
    ok: "Reachable",
    refused: "Key refused",
    down: "No answer"
  }[ health ];
  const dot = {
    off: "bg-foreground/30",
    asking: "animate-pulse bg-amber-500",
    ok: "bg-emerald-500",
    refused: "bg-red-500",
    down: "bg-red-500"
  }[ health ];
  const line = message ?? (
    ok && conn
      ? `${ conn.channels.length } account${ conn.channels.length === 1 ? "" : "s" } · Export proposes ${ defaults.size ? conn.channels.filter( ( c ) => defaults.has( c.id ) ).map( ( c ) => c.name )
        .join( ", " ) : "none yet — tick them below" }.`
      : health === "asking" ? "Asking your Postiz…" : "Paste your Postiz’s address and an API key below."
  );

  return (
    <Dialog
      open={ open }
      onClose={ onClose }
      className="relative z-80"
    >
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs"
        aria-hidden="true"
      />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="glass flex max-h-dvh w-full max-w-2xl flex-col overflow-hidden border border-theme shadow-lg sm:max-h-[90vh] sm:rounded-2xl">
          <div className="flex items-center gap-2 border-b border-theme px-4 py-2.5">
            <Send className="h-4 w-4 shrink-0 text-foreground" />
            <DialogTitle className="m-0 text-sm font-medium text-foreground">
              Publish with Postiz
            </DialogTitle>
            <button
              type="button"
              onClick={ onClose }
              aria-label="Close"
              className="-mr-2 ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-label transition-colors hover:bg-hover hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
            <p className="m-0 text-sm leading-relaxed text-foreground/80">
              Your own Postiz publishes to Instagram, TikTok, YouTube, Threads, X or Bluesky for you. Sketchbook renders an export, sends it
              there and schedules it — from the Export dialog, or through Claude.
            </p>

            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-theme px-3 py-2.5"
              aria-live="polite"
            >
              <span className="font-mono text-xs text-label">{host ?? "Postiz"}</span>
              <span className={ clsx(
                "flex items-center gap-1.5 text-xs font-medium",
                health === "ok" ? "text-emerald-500" : health === "refused" || health === "down" ? "text-red-500" : "text-label"
              ) }
              >
                <span className={ clsx(
                  "h-2 w-2 rounded-full",
                  dot
                ) }
                />
                {stateWord}
              </span>
              {conn && ( confirmForget ? (
                <span className="ml-auto flex gap-1.5">
                  <button
                    type="button"
                    className="rounded-lg border border-red-500/40 bg-background px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/5"
                    onClick={ () => {
                      forgetPostiz();
                      setConfirmForget( false );
                      setHealth( "off" );
                      setMessage( null );
                    } }
                  >
                    Forget it
                  </button>
                  <button type="button" className={ GHOST } onClick={ () => setConfirmForget( false ) }>Keep</button>
                </span>
              ) : (
                <button
                  type="button"
                  className={ clsx(
                    GHOST,
                    "ml-auto"
                  ) }
                  title="Drops the address and the API key from this browser. Nothing changes in Postiz."
                  onClick={ () => setConfirmForget( true ) }
                >
                  Forget
                </button>
              ) )}
              <p className={ clsx(
                "m-0 basis-full text-xs leading-snug",
                health === "refused" || health === "down" ? "text-red-500" : "text-label"
              ) }
              >
                {line}
              </p>
            </div>

            <ol className="m-0 flex list-none flex-col gap-5 p-0">
              <Step n={ 1 } title="Let your Postiz answer this site" done={ corsDone } hot={ health === "down" }>
                {corsDone ? (
                  <Hint>It answers <code className="font-mono text-xs text-foreground">{origin}</code>.</Hint>
                ) : (
                  <>
                    <Hint>A Postiz only answers the websites it knows. Add this address to the origins it allows — the list Atelier is already on:</Hint>
                    <div className="relative">
                      <pre aria-label="This site’s address" className="m-0 select-all break-all rounded-lg border border-theme bg-hover py-2.5 pl-3 pr-20 font-mono text-xs text-foreground">{origin}</pre>
                      <button
                        type="button"
                        onClick={ () => void navigator.clipboard?.writeText( origin ).then(
                          () => setCopied( true ),
                          () => setCopied( false )
                        ) }
                        aria-label={ copied ? "Address copied" : "Copy the address" }
                        className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md border border-theme bg-background px-2 py-1 text-xs text-label transition-colors hover:text-foreground"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </>
                )}
              </Step>

              <Step n={ 2 } title="Paste its address and an API key" done={ ok } hot={ health === "refused" }>
                {connected && conn ? (
                  <Hint>
                    {host} · the key is kept in this browser ·{" "}
                    <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={ () => setConfirmForget( true ) }>
                      use another
                    </button>
                  </Hint>
                ) : (
                  <>
                    <input
                      id="postiz-address"
                      type="url"
                      inputMode="url"
                      className={ INPUT }
                      value={ address }
                      onChange={ ( event ) => setAddress( event.target.value ) }
                      placeholder="https://postiz.example"
                      spellCheck={ false }
                      aria-label="Postiz address"
                    />
                    <input
                      id="postiz-key"
                      type="password"
                      className={ clsx(
                        INPUT,
                        "font-mono"
                      ) }
                      value={ key }
                      onChange={ ( event ) => setKey( event.target.value ) }
                      onKeyDown={ ( event ) => {
                        if ( event.key === "Enter" && ready && health !== "asking" ) {
                          void connect();
                        }
                      } }
                      placeholder="API key"
                      autoComplete="off"
                      spellCheck={ false }
                      aria-label="Postiz API key"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" className={ INK } disabled={ !ready || health === "asking" } onClick={ () => void connect() }>
                        {health === "asking" ? "Asking…" : "Connect Postiz"}
                      </button>
                      <span className="text-xs text-label">
                        The key is in Postiz under <b className="font-medium text-foreground/80">Settings › Public API</b>. It stays in this browser;
                        Sketchbook’s server never sees it.
                      </span>
                    </div>
                  </>
                )}
              </Step>

              <Step n={ 3 } title="Choose where posts go">
                {!conn ? (
                  <Hint>Once your Postiz answers, its accounts appear here: tick the ones Export proposes by default.</Hint>
                ) : (
                  <>
                    {conn.channels.length === 0 ? (
                      <Hint>This Postiz has no account yet: add one there (Add Channel), then open this again.</Hint>
                    ) : (
                      <div role="group" aria-label="Accounts Export proposes" className="flex flex-wrap gap-1.5">
                        {conn.channels.map( ( channel ) => (
                          <ChannelChip
                            key={ channel.id }
                            channel={ channel }
                            checked={ defaults.has( channel.id ) }
                            disabledReason={ providerOf( channel.identifier ) === "other" ? OTHER_PROVIDER : null }
                            onToggle={ () => updatePostiz( {
                              defaultChannelIds: defaults.has( channel.id )
                                ? conn.defaultChannelIds.filter( ( id ) => id !== channel.id )
                                : [
                                  ...conn.defaultChannelIds,
                                  channel.id
                                ]
                            } ) }
                          />
                        ) )}
                      </div>
                    )}
                    <Hint>Ticked here is only what a new post starts with: every post picks its own accounts in Export.</Hint>
                    {instagramAccounts.length > 1 && (
                      <div className="flex flex-col gap-1.5">
                        <span className={ LEGEND }>Your Instagram usernames</span>
                        <Hint>A post on one of your accounts can invite another as collaborator — one post, co-signed. Instagram needs each username for that.</Hint>
                        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                          {instagramAccounts.map( ( channel ) => (
                            <li key={ channel.id } className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                              <span className="truncate text-xs text-foreground">{channel.name}</span>
                              <input
                                id={ `postiz-handle-${ channel.id }` }
                                className={ clsx(
                                  INPUT,
                                  "font-mono"
                                ) }
                                value={ conn.handles[ channel.id ] ?? channel.handle ?? "" }
                                onChange={ ( event ) => updatePostiz( {
                                  handles: {
                                    ...conn.handles,
                                    [ channel.id ]: cleanHandle( event.target.value )
                                  }
                                } ) }
                                placeholder="username, without @"
                                spellCheck={ false }
                                aria-label={ `Instagram username of ${ channel.name }` }
                              />
                            </li>
                          ) )}
                        </ul>
                      </div>
                    )}
                    <label className="flex flex-col gap-1.5">
                      <span className={ LEGEND }>Another collaborator to propose</span>
                      <input
                        id="postiz-collaborator"
                        className={ INPUT }
                        value={ conn.collaborator }
                        onChange={ ( event ) => updatePostiz( {
                          collaborator: event.target.value
                        } ) }
                        placeholder="instagram handle, without @"
                        spellCheck={ false }
                      />
                    </label>
                    <RhythmRow conn={ conn } />
                    <PhrasesEditor
                      phrases={ conn.phrases }
                      dayStart={ conn.dayStart }
                      onChange={ ( patch ) => updatePostiz( patch ) }
                    />
                    {/* Statistics' switch (`docs/memory/statistics.md`). */}
                    <ResultsSettings apiBase={ conn.apiBase } apiKey={ conn.apiKey } channels={ conn.channels } />
                  </>
                )}
              </Step>
            </ol>

            <div>
              <p className={ LEGEND }>Good to know</p>
              <div className="mt-1">
                <Faq q="Where is my API key kept?">
                  <p className="m-0">
                    In this browser only (local storage), until you press Forget. Sketchbook has no account and its server
                    never receives the key: this tab talks to your Postiz directly.
                  </p>
                </Faq>
                <Faq q="What does Sketchbook send, and when?">
                  <p className="m-0">
                    Nothing at load. Opening this window asks your Postiz which accounts it has; opening Export reads the
                    coming weeks’ posts, to mark the slots taken. With Results on (off by default), opening the Gallery
                    or a sketch’s sheet also asks it for the figures of your posts that are out — a few posts at a time. Files and the caption leave only when you press Schedule,
                    Publish now or Send as a draft — or when you ask Claude to.
                  </p>
                </Faq>
                <Faq q="Why is every post tagged Sketchbook?">
                  <p className="m-0">
                    Your other apps post through the same Postiz, so each tags what it sends with its own name and lists only
                    its own posts — while the free slots still count every post. Postiz keeps a tag only if one of that name
                    exists: create it once in Postiz (Create Post › Tags › Add New Tag, named Sketchbook).
                  </p>
                </Faq>
                <Faq q="It says your Postiz did not answer.">
                  <p className="m-0">
                    Almost always step 1: a browser hides a refusal for another site as a bare network error. Check that{" "}
                    <code className="font-mono text-xs text-foreground">{origin}</code> is in your Postiz’s allowed
                    origins, then connect again.
                  </p>
                </Faq>
                <Faq q="Which exports can it post?">
                  <p className="m-0">
                    mp4 videos and png pictures — sent as JPEG, which Instagram requires; your download stays png. Not GIF
                    nor WebM. A file is at most 95 MB, a picture 10 MB, a carousel 10 files; X and Bluesky take 4 pictures or one video. Each account can take its own variant: Export remembers which format it usually gets.
                  </p>
                </Faq>
                <Faq q="How do I remove it?">
                  <p className="m-0">Press Forget above. Nothing changes in Postiz: revoke the key there to end it.</p>
                </Faq>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
