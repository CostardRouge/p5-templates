"use client";

import React, {
  useState
} from "react";
import {
  Film, Loader2
} from "lucide-react";
import clsx from "clsx";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type ActionState = "idle" | "generating" | "done" | "error";

export default function GeneratePreviewButton() {
  const [
    {
      name, engineId
    }
  ] = useSketch();
  const [
    state,
    setState
  ] = useState<ActionState>( "idle" );
  const [
    errorMessage,
    setErrorMessage
  ] = useState<string | null>( null );

  if ( process.env.NODE_ENV !== "development" ) {
    return null;
  }

  const handleClick = async( e: React.MouseEvent ) => {
    e.stopPropagation();

    if ( state === "generating" ) {
      return;
    }

    setState( "generating" );
    setErrorMessage( null );

    try {
      const res = await fetch(
        "/api/dev/previews/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify( {
            sketch: name,
            engineId
          } )
        }
      );

      if ( !res.ok ) {
        const text = await res.text();

        throw new Error( text || `HTTP ${ res.status }` );
      }

      setState( "done" );
      setTimeout(
        () => setState( "idle" ),
        1500
      );
    } catch( err ) {
      setErrorMessage( err instanceof Error ? err.message : String( err ) );
      setState( "error" );
      setTimeout(
        () => setState( "idle" ),
        3000
      );
    }
  };

  const title =
    state === "error"
      ? ( errorMessage ?? "Error" )
      : "Generate preview for this sketch (overwrites existing)";

  return (
    <button
      type="button"
      onClick={ handleClick }
      disabled={ state === "generating" }
      title={ title }
      aria-label={ title }
      className={ clsx(
        "flex items-center rounded transition-colors",
        {
          "hover:text-yellow-400 cursor-pointer":
            state === "idle",
          "text-yellow-400/50 cursor-wait":
            state === "generating",
          "text-green-400":
            state === "done",
          "text-red-400":
            state === "error"
        }
      ) }
    >
      {state === "generating" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Film className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
