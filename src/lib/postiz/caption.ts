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
import {
  composeCaption, DEFAULT_PHRASES, type Phrase
} from "./pills";

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

/** Sketchbook's own caption (lab 1's Q5, the long one), in pills since lab 4: the same words, the house tags now his phrase. */
export const DEFAULT_CAPTION = "{title}\n{description}\n\n{engine} · {loop} · {link}\n{tags} {phrase:house}";

/** Sketchbook's own SHORT caption, for Threads (500), X (280) and Bluesky (300). */
export const DEFAULT_SHORT_CAPTION = "{title} — {engine}, a {seconds} s loop\n{link}\n{tags}";

/**
 * The template filled for no network in particular: each pill its value
 * (`pills.ts`), an unknown token left as typed, a line of empty pills folded,
 * blank runs folded. A network's own words go through `composeCaption`.
 */
export function fillCaption(
  template: string, facts: CaptionFacts, phrases: readonly Phrase[] = DEFAULT_PHRASES
): string {
  return composeCaption(
    template,
    {
      facts,
      at: null,
      timeZone: "UTC",
      dayStart: null,
      phrases
    },
    null
  ).text;
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
