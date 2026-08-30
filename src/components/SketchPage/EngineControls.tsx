"use client";

import Github from "@/components/ui/GithubIcon";
import Link from "next/link";
import {
  resolveSketchPath
} from "@/engines/metadata";
import useSketch from "../ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import SketchShareDialog from "./SketchShareDialog";

/**
 * What the sketch *is*, rather than what it is doing: a link to its source and
 * the share/embed dialog.
 *
 * Playback and still capture used to sit here too, duplicating the transport
 * bar an island's width away from the scrubber they belong with. Both moved —
 * play/pause to `TransportBar`, the snapshot (dev double-click included) to
 * `SnapshotButton` inside it.
 *
 * `variant` "floating" (default) renders the rounded island anchored to the
 * top-left of the viewport; "bar" renders the buttons flat for hosting inside
 * the docked workspace top bar, which supplies the surface.
 */
export function EngineControls( {
  variant = "floating"
}: {
  variant?: "floating" | "bar";
} = {} ) {
  const [
    {
      engineId, name
    }
  ] = useSketch();

  const githubRepoUrl = process.env.NEXT_PUBLIC_GITHUB_REPO_URL;
  const sketchPath = githubRepoUrl ? resolveSketchPath(
    name,
    engineId
  ) : undefined;
  // DOM engines (GSAP/HTML) author sketches as React `.jsx`; p5 uses `.js`.
  const entryExtension = engineId === "gsap" ? "jsx" : "js";
  const githubUrl =
    githubRepoUrl && sketchPath
      ? `${ githubRepoUrl }/blob/main/src/sketches/${ engineId }/sketches/${ sketchPath }/index.${ entryExtension }`
      : undefined;

  const controls = (
    <>
      { githubUrl && (
        <Link
          href={ githubUrl }
          target="_blank"
          rel="noopener noreferrer"
          title="View source code on GitHub"
          aria-label="View source code on GitHub"
          className="hidden md:inline-flex h-full px-3 hover:bg-hover transition-colors border-r border-border group items-center justify-center"
        >
          <Github className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
        </Link>
      ) }
      <SketchShareDialog />
    </>
  );

  if ( variant === "bar" ) {
    // Full height so the buttons' dividers span the whole top bar.
    return (
      <div className="flex items-stretch h-full overflow-hidden">
        {controls}
      </div>
    );
  }

  return (
    <div className="absolute top-2 left-[3.25rem] md:top-4 md:left-[3.75rem] flex items-center gap-2 z-50">
      <div className="flex items-center h-9 bg-background/90 backdrop-blur-xl border border-border rounded-xl shadow-md overflow-hidden">
        {controls}
      </div>
    </div>
  );
}
