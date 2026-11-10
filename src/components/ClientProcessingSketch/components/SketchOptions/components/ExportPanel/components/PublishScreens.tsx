"use client";

import React, {
  useEffect, useRef, useState
} from "react";
import {
  ArrowLeft, Check, ExternalLink
} from "lucide-react";
import {
  PROVIDER_LABEL, providerOf, type PostizChannel
} from "@/lib/postiz/client";
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

/**
 * What was sent, in the table's place (lab 1 §6): the vignette, when it goes
 * out, each account with its state, *Open in Postiz*, *Take back* (confirmed
 * in place, `DELETE /posts/:id`) for anything not yet out, and the way back.
 */
export function PublishSent( {
  publication, channels, files, timeZone, postizUrl, onTakeBack, onBack
}: {
  publication: Publication;
  channels: PostizChannel[];
  files: File[];
  timeZone: string;
  postizUrl: string;
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
  const title = publication.target === "now"
    ? "Sent — publishing now"
    : publication.target === "draft" ? "In Postiz as a draft" : "Scheduled";
  const when = publication.target === "now"
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
  const state = publication.target === "draft" ? "draft" : publication.target === "now" ? "publishing" : "queued";

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
              <span className="grid h-6 w-6 place-items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-500">
                <Check className="h-3.5 w-3.5" />
              </span>
              {title}
            </h3>
            <p className="m-0 text-sm tabular-nums text-foreground">{when}</p>
            <ul className="m-0 list-none rounded-lg border border-theme p-0">
              {channels.map( ( channel ) => (
                <li key={ channel.id } className="flex items-center gap-2 border-b border-theme px-3 py-2 text-xs last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-foreground">{channel.name}</span>
                  <span className="font-mono text-[10px] text-label">{PROVIDER_LABEL[ providerOf( channel.identifier ) ]}</span>
                  <span className={ state === "draft" ? "font-mono text-[10px] text-label" : "font-mono text-[10px] text-emerald-500" }>{state}</span>
                </li>
              ) )}
            </ul>
            <p className="m-0 font-mono text-[10px] text-label">
              {publication.files} file{publication.files === 1 ? "" : "s"} from {publication.variantName} · caption approved
            </p>
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-xs font-medium text-background no-underline transition-opacity hover:opacity-85 pointer-coarse:min-h-11"
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
