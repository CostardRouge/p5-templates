"use client";

import sleep from "@/utils/sleep";
import clsx from "clsx";
import {
  ImagePlus
} from "lucide-react";
import {
  useState
} from "react";

type GenerateThumbnailsButtonProps = {
  hasMissingThumbnails: boolean;
};

export default function GenerateThumbnailsButton( {
  hasMissingThumbnails,
}: GenerateThumbnailsButtonProps ) {
  const [
    generating,
    setGenerating
  ] = useState( false );

  if ( !hasMissingThumbnails ) {
    return null;
  }

  async function handleClick() {
    setGenerating( true );

    try {
      await fetch( "/api/thumbnails/generate" );
      await sleep( 1000 ); // Wait a moment to ensure thumbnails are generated before refreshing
      window.location.reload();
    } finally {
      setGenerating( false );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={generating}
        title="Generate missing thumbnails"
        className={clsx(
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300",
          generating
            ? "opacity-50 cursor-not-allowed text-foreground/70"
            : "text-foreground/70 hover:text-foreground hover:bg-hover/50"
        )}
      >
        <ImagePlus className={clsx(
          "w-4 h-4",
          generating && "animate-pulse"
        )} />
        <span className="hidden sm:inline">
          {generating ? "generating\u2026" : "generate thumbnails"}
        </span>
      </button>
      <div className="w-px h-6 bg-border" />
    </>
  );
}
