"use client";

import React, {
  useEffect, useRef, useState
} from "react";
import clsx from "clsx";
import {
  Bookmark, BookmarkCheck, Loader2
} from "lucide-react";
import {
  useFormContext
} from "react-hook-form";

import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  keepPiece
} from "@/lib/gallery/keep";
import {
  getGalleryStore
} from "@/lib/gallery/store";
import {
  captureGalleryThumbnail
} from "@/lib/gallery/thumbnail";

type KeepState = "idle" | "saving" | "kept" | "same" | "error";

const RESET_MS: Record<Exclude<KeepState, "idle" | "saving">, number> = {
  kept: 1800,
  same: 2200,
  error: 3000
};

/**
 * The third way out of the sketch, beside the still and the video: keep the
 * piece — the whole document plus a thumbnail of this frame — in the browser's
 * gallery (`/gallery`), to find and relaunch later. The same gesture runs by
 * itself at the end of a successful export; this button is for a piece worth
 * finding again without exporting it.
 *
 * The button says what happened on itself, as the snapshot button does: a
 * check for a new entry, "already kept" when nothing changed since the last
 * entry of this sketch, the error otherwise — never silently.
 */
export default function KeepButton() {
  const [
    {
      engineId, category, name, engine
    }
  ] = useSketch();
  const form = useFormContext();
  const [
    state,
    setState
  ] = useState<KeepState>( "idle" );
  const [
    message,
    setMessage
  ] = useState<string | null>( null );
  const timer = useRef<ReturnType<typeof setTimeout> | null>( null );

  useEffect(
    () => () => {
      if ( timer.current ) {
        clearTimeout( timer.current );
      }
    },
    []
  );

  const settle = (
    next: Exclude<KeepState, "idle" | "saving">, text: string | null
  ) => {
    setState( next );
    setMessage( text );
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setState( "idle" );
      },
      RESET_MS[ next ]
    );
  };

  const handleClick = async() => {
    if ( state === "saving" ) {
      return;
    }
    if ( timer.current ) {
      clearTimeout( timer.current );
      timer.current = null;
    }
    setState( "saving" );

    try {
      const thumbnail = await captureGalleryThumbnail( engine );
      const {
        kept
      } = await keepPiece(
        getGalleryStore(),
        {
          engine: engineId,
          category,
          name,
          options: form.getValues(),
          origin: "keep",
          thumbnail
        }
      );

      settle(
        kept ? "kept" : "same",
        kept ? "Kept in the gallery" : "Already in the gallery — nothing changed since"
      );
    } catch( error ) {
      settle(
        "error",
        error instanceof Error ? error.message : String( error )
      );
    }
  };

  const title = state === "idle" || state === "saving"
    ? "Keep this piece in the gallery (options + thumbnail)"
    : message ?? "";

  return (
    <button
      type="button"
      onClick={ () => void handleClick() }
      disabled={ state === "saving" }
      title={ title }
      aria-label="Keep this piece in the gallery"
      data-keep-state={ state }
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-hover disabled:cursor-not-allowed"
    >
      {state === "saving" ? (
        <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
      ) : state === "kept" || state === "same" ? (
        <BookmarkCheck
          className={ clsx(
            "h-4 w-4",
            state === "kept" ? "text-green-500" : "text-foreground/60"
          ) }
        />
      ) : (
        <Bookmark
          className={ clsx(
            "h-4 w-4 transition-colors",
            state === "error" ? "text-red-400" : "text-foreground"
          ) }
        />
      )}
    </button>
  );
}
