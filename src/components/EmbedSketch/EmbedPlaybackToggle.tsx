"use client";

import {
  Pause, Play
} from "lucide-react";

type EmbedPlaybackToggleProps = {
  playing: boolean;
  onToggle: () => void;
};

/**
 * Small glass play/pause control, bottom-right of a running embed. Lets a
 * viewer stop the draw loop to save CPU/battery (notably on mobile) without
 * leaving the page. The engine stays mounted, so resuming is instant.
 */
export default function EmbedPlaybackToggle( {
  playing,
  onToggle
}: EmbedPlaybackToggleProps ) {
  return (
    <button
      type="button"
      onClick={ onToggle }
      className="embed-playback-toggle glass"
      aria-label={ playing ? "Pause animation" : "Play animation" }
      aria-pressed={ playing }
    >
      {playing ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4 translate-x-px" />
      )}
    </button>
  );
}
