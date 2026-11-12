"use client";

import React, {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  ArrowLeft, Check, ExternalLink, RefreshCw, TriangleAlert
} from "lucide-react";
import {
  failureHint, PROVIDER_LABEL, providerOf, type PostizChannel, type PostizPost
} from "@/lib/postiz/client";
import {
  failedChannels, readOutcomes, stillMoving, type AccountOutcome
} from "@/lib/postiz/outcome";
import {
  KIND_LABEL
} from "@/lib/postiz/postShape";
import type {
  Publication
} from "@/lib/postiz/publishStore";
import {
  slotLabel
} from "@/lib/postiz/rhythm";

/**
 * The first file, as the screen's vignette: the picture, or the video playing
 * muted. The object URL is made, set on the element and revoked by ONE effect
 * — one made in render and revoked in a cleanup is dead after React's
 * development double-run (the first build showed a broken image).
 */
function Vignette( {
  file, label
}: {
  file: File | undefined;
  label: string;
} ) {
  const media = useRef<HTMLVideoElement | HTMLImageElement | null>( null );
  const video = Boolean( file?.type.startsWith( "video/" ) );

  useEffect(
    () => {
      const element = media.current;

      if ( !file || !element ) {
        return;
      }

      const url = URL.createObjectURL( file );

      element.src = url;

      return () => {
        element.removeAttribute( "src" );
        URL.revokeObjectURL( url );
      };
    },
    [
      file
    ]
  );

  return (
    <div className="relative w-full max-w-[220px] overflow-hidden rounded-lg border border-theme bg-foreground/5">
      {file && video && (
        <video
          ref={ ( element ) => {
            media.current = element;
          } }
          muted
          loop
          autoPlay
          playsInline
          className="block h-auto w-full"
        />
      )}
      {file && !video && (

        <img
          ref={ ( element ) => {
            media.current = element;
          } }
          alt="What was sent"
          className="block h-auto w-full"
        />
      )}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">{label}</span>
    </div>
  );
}

const SCREEN = "grid min-h-0 flex-1 grid-cols-1 content-start gap-5 overflow-y-auto bg-background p-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:p-5";

/**
 * Before Publish now — the one send that cannot be taken back — the file is
 * shown with the caption it carries and the accounts it goes to, and only a
 * second press sends it (lab 1, Q1). Takes the table's place, as the preview
 * does.
 */
export function PublishReview( {
  files, caption, targets, sending, onConfirm, onBack
}: {
  files: File[];
  caption: string;
  targets: PostizChannel[];
  sending: boolean;
  onConfirm: () => void;
  onBack: () => void;
} ) {
  const bytes = files.reduce(
    (
      sum, f
    ) => sum + f.size,
    0
  );

  return (
    <div className={ SCREEN }>
      <Vignette file={ files[ 0 ] } label={ files.length > 1 ? `${ files.length } files` : "1 file" } />
      <div className="flex min-w-0 flex-col gap-3">
        <h3 className="m-0 text-base font-semibold text-foreground">Publish this now?</h3>
        <p className="m-0 text-xs leading-relaxed text-label">
          {files.length} file{files.length === 1 ? "" : "s"} · {( bytes / 1024 / 1024 ).toFixed( 1 )} MB, to{" "}
          {targets.map( ( c ) => c.name ).join( ", " )} at once. A published post cannot be taken back from here.
        </p>
        <p className="m-0 max-h-40 overflow-y-auto whitespace-pre-wrap border-l-2 border-theme pl-3 text-xs leading-relaxed text-foreground/80">{caption || "—"}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ sending }
            onClick={ onConfirm }
            className="rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40 pointer-coarse:min-h-11"
          >
            {sending ? "Sending…" : "Publish now"}
          </button>
          <button
            type="button"
            disabled={ sending }
            onClick={ onBack }
            className="inline-flex items-center gap-1.5 rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-40 pointer-coarse:min-h-11"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the variants
          </button>
        </div>
      </div>
    </div>
  );
}

const STATE_WORD: Record<AccountOutcome[ "state" ], string> = {
  queue: "queued",
  published: "published",
  error: "failed",
  draft: "draft",
  unknown: "sent"
};

/** How long a "now" send is watched before the screen leaves it to *Check again*. */
const WATCH_MS = 5 * 60 * 1000;
const WATCH_EVERY_MS = 20 * 1000;

/** One failed post: Postiz's first sentence, what to do, and its whole words on demand. */
function Failure( {
  error
}: {
  error: string | null;
} ) {
  const [
    raw,
    setRaw
  ] = useState( false );
  const hint = failureHint( error );
  const first = ( error ?? "Postiz could not publish it, and said nothing more." ).split( /(?<=\.)\s/ )[ 0 ];

  return (
    <span className="flex flex-col gap-1 text-[11px] leading-snug">
      <span className="text-red-500">{first}</span>
      {hint && <span className="text-foreground">{hint}</span>}
      {error && error.trim() !== first.trim() && (
        <button
          type="button"
          aria-expanded={ raw }
          onClick={ () => setRaw( ( r ) => !r ) }
          className="self-start border-0 bg-transparent p-0 font-mono text-[10px] text-label underline"
        >
          {raw ? "Hide what Postiz said" : "What Postiz said"}
        </button>
      )}
      {raw && <span className="whitespace-pre-wrap break-words font-mono text-[10px] text-label">{error}</span>}
    </span>
  );
}

/**
 * What was sent, in the table's place (lab 1 §6): the vignette, when it goes
 * out, each account with its REAL state as Postiz lists it (watched for five
 * minutes after a Publish now, *Check again* after), what a failure means and
 * the two ways out of one — *Send again* (the same files, the failed accounts
 * only) and *Choose again* (back to the variants with only them ticked, to
 * give one a picture instead) —, *Open in Postiz*, *Take back* (confirmed in
 * place, `DELETE /posts/:id`) for anything not yet out, and the way back.
 */
export function PublishSent( {
  publication, channels, files, timeZone, postizUrl, onCheck, onSendAgain, onChooseAgain, onTakeBack, onBack
}: {
  publication: Publication;
  channels: PostizChannel[];
  files: File[];
  timeZone: string;
  postizUrl: string;
  /** The posts Postiz lists around this send. */
  onCheck: () => Promise<PostizPost[]>;
  /** The same files again, to the failed posts' accounts only; null once the files are gone. */
  onSendAgain: ( ( failed: AccountOutcome[] ) => Promise<void> ) | null;
  onChooseAgain: ( channelIds: string[] ) => void;
  onTakeBack: () => Promise<void>;
  onBack: () => void;
} ) {
  const [
    confirming,
    setConfirming
  ] = useState( false );
  const [
    taking,
    setTaking
  ] = useState( false );
  const [
    taken,
    setTaken
  ] = useState( false );
  const [
    error,
    setError
  ] = useState<string | null>( null );
  const [
    outcomes,
    setOutcomes
  ] = useState<AccountOutcome[] | null>( null );
  const [
    checking,
    setChecking
  ] = useState( false );
  const [
    resending,
    setResending
  ] = useState( false );
  const checkRef = useRef( onCheck );

  useEffect(
    () => {
      checkRef.current = onCheck;
    },
    [
      onCheck
    ]
  );

  const check = useCallback(
    async() => {
      setChecking( true );

      try {
        const found = readOutcomes(
          publication,
          await checkRef.current()
        );

        setOutcomes( found );
        setError( null );

        return found;
      } catch( caught ) {
        setError( caught instanceof Error ? caught.message : String( caught ) );

        return null;
      } finally {
        setChecking( false );
      }
    },
    [
      publication
    ]
  );

  // Looked once on arrival (and after a resend); a Publish now is watched
  // until every account has an answer, five minutes at most.
  useEffect(
    () => {
      let stop = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const until = Date.now() + WATCH_MS;
      const look = async() => {
        const found = await check();

        if ( !stop && publication.target === "now" && ( !found || stillMoving( found ) ) && Date.now() < until ) {
          timer = setTimeout(
            () => void look(),
            WATCH_EVERY_MS
          );
        }
      };

      timer = setTimeout(
        () => void look(),
        publication.target === "now" ? 4000 : 0
      );

      return () => {
        stop = true;
        clearTimeout( timer );
      };
    },
    [
      check,
      publication.target
    ]
  );

  const failed = outcomes ? failedChannels( outcomes ) : [];
  // Named by network (his accounts share one name); by name and network when a network repeats.
  const failedNames = channels.filter( ( c ) => failed.includes( c.id ) ).map( (
    c, i, all
  ) => {
    const net = PROVIDER_LABEL[ providerOf( c.identifier ) ];

    return all.filter( ( o ) => providerOf( o.identifier ) === providerOf( c.identifier ) ).length > 1 ? `${ c.name } on ${ net }` : net;
  } );
  const wentOut = outcomes ? channels.filter( ( c ) => outcomes.some( ( o ) => o.channelId === c.id && !o.story && o.state === "published" ) ).length : 0;
  const title = failed.length
    ? `${ failed.length === channels.length ? "Not published" : "Sent, but not everywhere" }`
    : publication.target === "now"
      ? "Sent — publishing now"
      : publication.target === "draft" ? "In Postiz as a draft" : "Scheduled";
  const when = failed.length
    ? `Out on ${ wentOut } of ${ channels.length } accounts${ wentOut < channels.length - failed.length ? " so far" : "" }.`
    : publication.target === "now"
      ? "Your Postiz is publishing it; it is live in a minute or two."
      : publication.target === "draft" || !publication.at
        ? "Open it in Postiz to finish and send it."
        : `${ slotLabel(
          new Date( publication.at ),
          timeZone
        ) } · ${ timeZone.replace(
          /_/g,
          " "
        ) }`;
  const fallback: AccountOutcome[ "state" ] = publication.target === "draft" ? "draft" : "unknown";

  const takeBack = async() => {
    setTaking( true );
    setError( null );

    try {
      await onTakeBack();
      setTaken( true );
      setConfirming( false );
    } catch( caught ) {
      setError( caught instanceof Error ? caught.message : String( caught ) );
    } finally {
      setTaking( false );
    }
  };

  const sendAgain = async() => {
    if ( !onSendAgain ) {
      return;
    }

    setResending( true );
    setError( null );

    try {
      await onSendAgain( ( outcomes ?? [] ).filter( ( o ) => o.state === "error" && failed.includes( o.channelId ) ) );
      setOutcomes( null );
    } catch( caught ) {
      setError( caught instanceof Error ? caught.message : String( caught ) );
    } finally {
      setResending( false );
    }
  };

  return (
    <div className={ SCREEN }>
      <Vignette file={ files[ 0 ] } label={ KIND_LABEL[ publication.kind ] + ( publication.files > 1 ? ` · ${ publication.files }` : "" ) } />
      <div className="flex min-w-0 flex-col gap-3" aria-live="polite">
        {taken ? (
          <>
            <h3 className="m-0 text-base font-semibold text-foreground">Taken back</h3>
            <p className="m-0 text-xs leading-relaxed text-label">
              Your Postiz deleted it; nothing will go out. The files are still here — send them again from the variants.
            </p>
          </>
        ) : (
          <>
            <h3 className="m-0 flex items-center gap-2 text-base font-semibold text-foreground">
              {failed.length ? (
                <span className="grid h-6 w-6 place-items-center rounded-full border border-red-500/50 bg-red-500/10 text-red-500">
                  <TriangleAlert className="h-3.5 w-3.5" />
                </span>
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-500">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              {title}
            </h3>
            <p className="m-0 text-sm tabular-nums text-foreground">{when}</p>
            <ul className="m-0 list-none rounded-lg border border-theme p-0">
              {channels.map( ( channel ) => {
                const mine = outcomes?.filter( ( o ) => o.channelId === channel.id ) ?? [];
                const worst = mine.find( ( o ) => o.state === "error" ) ?? mine.find( ( o ) => o.state !== "published" ) ?? mine[ 0 ];
                const state = worst?.state ?? fallback;
                const live = mine.find( ( o ) => o.url )?.url;

                return (
                  <li key={ channel.id } className="flex flex-col gap-1.5 border-b border-theme px-3 py-2 text-xs last:border-b-0">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-foreground">{channel.name}</span>
                      <span className="font-mono text-[10px] text-label">{PROVIDER_LABEL[ providerOf( channel.identifier ) ]}</span>
                      {live ? (
                        <a href={ live } target="_blank" rel="noreferrer" className="font-mono text-[10px] text-emerald-500 underline">published</a>
                      ) : (
                        <span className={ `font-mono text-[10px] ${ state === "error" ? "text-red-500" : state === "draft" || state === "unknown" ? "text-label" : "text-emerald-500" }` }>
                          {state === "queue" && publication.target === "now" ? "publishing" : STATE_WORD[ state ]}
                        </span>
                      )}
                    </span>
                    {state === "error" && <Failure error={ worst?.error ?? null } />}
                  </li>
                );
              } )}
            </ul>
            <p className="m-0 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-label">
              <span>{publication.files} file{publication.files === 1 ? "" : "s"} from {publication.variantName} · caption approved</span>
              <button
                type="button"
                disabled={ checking }
                onClick={ () => void check() }
                className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-mono text-[10px] text-label underline disabled:no-underline"
              >
                <RefreshCw className={ `h-3 w-3 ${ checking ? "animate-spin" : "" }` } />
                {checking ? "Checking…" : "Check again"}
              </button>
            </p>
            {failed.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs text-foreground">
                <span>
                  Nothing went out on {failedNames.join( " and " ) || "those accounts"}. Send the same files again, or choose another variant for {failed.length === 1 ? "it" : "them"}.
                </span>
                <span className="flex flex-wrap gap-2">
                  {onSendAgain && (
                    <button
                      type="button"
                      disabled={ resending }
                      onClick={ () => void sendAgain() }
                      className="rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-85 disabled:opacity-40 pointer-coarse:min-h-11"
                    >
                      {resending ? "Sending…" : `Send again to ${ failedNames.join( " and " ) || "them" }`}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={ resending }
                    onClick={ () => onChooseAgain( failed ) }
                    className="rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover disabled:opacity-40 pointer-coarse:min-h-11"
                  >
                    Choose again
                  </button>
                </span>
              </div>
            )}
            {confirming && (
              <div className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-xs text-foreground">
                <span>Take it back from your Postiz? It will not go out.</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={ taking }
                    onClick={ () => void takeBack() }
                    className="rounded-lg border border-red-500/40 bg-background px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/5 disabled:opacity-40"
                  >
                    {taking ? "Taking back…" : "Take back"}
                  </button>
                  <button
                    type="button"
                    disabled={ taking }
                    onClick={ () => setConfirming( false ) }
                    className="rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-hover"
                  >
                    Keep it
                  </button>
                </span>
              </div>
            )}
            {error && <p className="m-0 text-xs text-red-500" role="alert">{error}</p>}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {!taken && (
            <a
              href={ postizUrl }
              target="_blank"
              rel="noreferrer"
              className={ `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium no-underline transition-opacity pointer-coarse:min-h-11 ${ failed.length ? "border border-theme bg-background text-foreground hover:bg-hover" : "border border-transparent bg-foreground text-background hover:opacity-85" }` }
            >
              Open in Postiz
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {!taken && publication.target !== "now" && !confirming && (
            <button
              type="button"
              onClick={ () => setConfirming( true ) }
              className="rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover pointer-coarse:min-h-11"
            >
              Take back
            </button>
          )}
          <button
            type="button"
            onClick={ onBack }
            className="inline-flex items-center gap-1.5 rounded-lg border border-theme bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-hover pointer-coarse:min-h-11"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the variants
          </button>
        </div>
      </div>
    </div>
  );
}
