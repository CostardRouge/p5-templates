"use client";

import sleep from "@/utils/sleep";
import clsx from "clsx";
import {
  Film
} from "lucide-react";
import {
  useState
} from "react";

type GeneratePreviewsButtonProps = {
  hasMissingPreviews: boolean;
};

export default function GeneratePreviewsButton( {
  hasMissingPreviews
}: GeneratePreviewsButtonProps ) {
  const [
    generating,
    setGenerating
  ] = useState( false );

  if ( !hasMissingPreviews ) {
    return null;
  }

  async function handleClick() {
    setGenerating( true );

    try {
      await fetch( "/api/previews/generate" );
      await sleep( 1000 );
      window.location.reload();
    } finally {
      setGenerating( false );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={ handleClick }
        disabled={ generating }
        title="Generate missing animated previews"
        className={ clsx(
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300",
          generating
            ? "opacity-50 cursor-not-allowed text-foreground/70"
            : "text-foreground/70 hover:text-foreground hover:bg-hover/50"
        ) }
      >
        <Film className={ clsx(
          "w-4 h-4",
          generating && "animate-pulse"
        ) } />
        <span className="hidden sm:inline">
          { generating ? "generating…" : "generate previews" }
        </span>
      </button>
      <div className="w-px h-6 bg-border" />
    </>
  );
}
