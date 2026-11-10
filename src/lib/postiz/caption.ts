/**
 * A post's caption: a TEMPLATE the person edits, filled with the sketch's own
 * words when it is sent — Atelier's rule (`recap-publish.ts`), with a
 * sketch's facts instead of a recap's.
 *
 * Pure. The facts are gathered by the studio (`publishFacts` in the Export
 * dialog and the `publish.facts` command) from the catalogue and the clock.
 */

import {
  CAPTION_LIMIT, providerOf
} from "./client";

/** The words a caption can carry. */
export interface CaptionFacts {
  /** `Iridescent · Peaks shell`. */
  title: string;
  /** The catalogue's `iridescent-v7-peaks-shell`. */
  sketch: string;
  /** The catalogue's description. */
  description: string;
  /** `#3d #mesh #iridescent`, from the catalogue's tags. */
  tags: string;
  /** `p5.js`, `GSAP`, `Three.js`. */
  engine: string;
  /** The loop's length in seconds, `12`. */
  seconds: string;
  /** The sketch's page, without the scheme. */
  link: string;
}

export const CAPTION_TOKENS: ReadonlyArray<keyof CaptionFacts> = [
  "title",
  "description",
  "tags",
  "engine",
  "seconds",
  "link",
  "sketch"
];

/** Sketchbook's own caption (the lab's Q5, his pick: the long one). */
export const DEFAULT_CAPTION = "{title}\n{description}\n\n{engine} · a {seconds} s loop · {link}\n{tags} #generativeart #creativecoding";

/** The template filled: each `{token}` its fact, an unknown one left as typed, blank runs folded. */
export function fillCaption(
  template: string, facts: CaptionFacts
): string {
  return template
    .replace(
      /\{(\w+)\}/g,
      (
        all, key: string
      ) => Object.prototype.hasOwnProperty.call(
        facts,
        key
      ) ? facts[ key as keyof CaptionFacts ] : all
    )
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

/** The longest caption every chosen account takes. */
export function captionLimit( identifiers: readonly string[] ): number {
  return identifiers.reduce(
    (
      min, identifier
    ) => Math.min(
      min,
      CAPTION_LIMIT[ providerOf( identifier ) ]
    ),
    CAPTION_LIMIT.instagram
  );
}

const ENGINE_LABEL: Record<string, string> = {
  p5: "p5.js",
  gsap: "GSAP",
  threejs: "Three.js",
  html: "HTML"
};

export function engineLabel( engineId: string ): string {
  return ENGINE_LABEL[ engineId ] ?? engineId;
}

/**
 * A person's name for a sketch: its category, then the rest of its name with
 * the version dropped — `iridescent-v7-peaks-shell` in `iridescent` reads
 * `Iridescent · Peaks shell`; without a category, `Voronoi cells`.
 */
export function sketchTitle(
  name: string, category?: string | null
): string {
  const cap = ( s: string ) => s.charAt( 0 ).toUpperCase() + s.slice( 1 );
  let words = name.split( "-" ).filter( Boolean );

  if ( category && words.length > 1 && words[ 0 ] === category ) {
    words = words.slice( 1 );
  }

  words = words.filter( ( w ) => !/^v\d+$/.test( w ) );

  const rest = cap( words.join( " " ) );

  if ( category ) {
    const head = cap( category.replace(
      /-/g,
      " "
    ) );

    return rest ? `${ head } · ${ rest }` : head;
  }

  return rest || name;
}

/** `#3d #mesh`: each tag a hashtag, spaces and dashes dropped, duplicates once. */
export function hashtags( tags: readonly string[] ): string {
  return [
    ...new Set( tags.map( ( t ) => t.toLowerCase().replace(
      /[^\p{L}\p{N}_]/gu,
      ""
    ) ).filter( Boolean ) )
  ].map( ( t ) => `#${ t }` )
    .join( " " );
}
