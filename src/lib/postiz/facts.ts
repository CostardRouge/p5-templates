/**
 * The words a caption can carry for one sketch, read from the catalogue the
 * browser already has (`@/engines/metadata`) and the sketch's own clock — for
 * the Export dialog's Post band and `publish.facts`.
 */

import {
  findSketchMeta
} from "@/engines/metadata";
import {
  resolveAnimation
} from "@/lib/animationConfig";
import {
  buildCanonicalPath, getBaseUrl
} from "@/lib/seo";
import {
  engineLabel, hashtags, sketchTitle, type CaptionFacts
} from "./caption";

export function publishFacts(
  name: string,
  engineId: string,
  animation?: { duration?: number;
    framerate?: number }
): CaptionFacts {
  const meta = findSketchMeta(
    name,
    engineId
  );
  const category = meta?.category ?? null;
  const seconds = resolveAnimation( animation ).duration;
  const base = typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test( window.location.host )
    ? window.location.origin
    : getBaseUrl();

  return {
    title: sketchTitle(
      name,
      category
    ),
    sketch: name,
    description: ( meta?.description ?? "" ).trim(),
    tags: hashtags( meta?.tags ?? [] ),
    engine: engineLabel( engineId ),
    seconds: String( Math.round( seconds * 10 ) / 10 ),
    link: `${ base }${ buildCanonicalPath(
      engineId,
      name,
      category
    ) }`.replace(
      /^https?:\/\//,
      ""
    )
  };
}
