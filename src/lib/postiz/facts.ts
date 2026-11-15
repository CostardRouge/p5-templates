/**
 * The words a caption can carry for one sketch, read from the catalogue the
 * browser already has (`@/engines/metadata`) and the sketch's own clock — for
 * the Export dialog's Post band and `publish.facts`.
 */

import {
  findSketchMeta, getMetadata
} from "@/engines/metadata";
import {
  resolveAnimation
} from "@/lib/animationConfig";
import {
  buildCanonicalPath, getBaseUrl
} from "@/lib/seo";
import {
  engineLabel, hashtags, sketchTitle
} from "./caption";
import type {
  PillFacts
} from "./pills";

/** `churros-v11-perspective` → 11; null without a `-vN`. */
export function versionOf( name: string ): number | null {
  const m = /(?:^|-)v(\d+)(?:-|$)/.exec( name );

  return m ? Number( m[ 1 ] ) : null;
}

/** Its place among its category's sketches, by name with numbers read as numbers (v2 before v10). */
export function rankIn(
  name: string, siblings: readonly string[]
): { rank: number | null;
  of: number | null } {
  const sorted = [
    ...siblings
  ].sort( (
    a, b
  ) => a.localeCompare(
    b,
    undefined,
    {
      numeric: true
    }
  ) );
  const i = sorted.indexOf( name );

  return i < 0 ? {
    rank: null,
    of: null
  } : {
    rank: i + 1,
    of: sorted.length
  };
}

export function publishFacts(
  name: string,
  engineId: string,
  animation?: { duration?: number;
    framerate?: number },
  slides = 1
): PillFacts {
  const meta = findSketchMeta(
    name,
    engineId
  );
  const category = meta?.category ?? null;
  const resolved = resolveAnimation( animation );
  const seconds = resolved.duration;
  const siblings = category ? getMetadata().filter( ( m ) => m.engine === engineId && m.category === category )
    .map( ( m ) => m.name ) : [];
  const place = rankIn(
    name,
    siblings
  );
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
    category: category ? category.split( "-" ).map( ( w ) => w.charAt( 0 ).toUpperCase() + w.slice( 1 ) )
      .join( " " ) : "",
    categorySlug: category ?? "",
    version: versionOf( name ),
    rank: place.rank,
    of: place.of,
    created: meta?.ctime ?? null,
    fps: resolved.framerate ? String( resolved.framerate ) : "",
    slides,
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
