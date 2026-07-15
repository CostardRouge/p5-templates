"use client";

import {
  Play
} from "lucide-react";

type EmbedPosterProps = {
  thumbnailUrl: string;
  hasThumbnail: boolean;
  /** Sketch name, for the accessible label. */
  label: string;
  onStart: () => void;
};

/**
 * Shown in place of the canvas when autoplay is off (explicit policy, mobile,
 * or reduced-motion). The engine — and therefore p5 — is not mounted until the
 * viewer starts it, so an idle embed costs only the thumbnail image. A sober,
 * centred play badge signals the click affordance without covering the art.
 */
export default function EmbedPoster( {
  thumbnailUrl,
  hasThumbnail,
  label,
  onStart
}: EmbedPosterProps ) {
  return (
    <button
      type="button"
      onClick={ onStart }
      className="embed-poster"
      aria-label={ `Play ${ label }` }
    >
      {hasThumbnail && (
        <img
          src={ thumbnailUrl }
          alt=""
          draggable={ false }
          className="embed-poster-image"
        />
      )}
      <span className="embed-play-badge" aria-hidden="true">
        <Play className="h-6 w-6 translate-x-0.5" />
      </span>
    </button>
  );
}
