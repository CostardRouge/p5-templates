/**
 * `/llms.txt` (https://llmstxt.org): a plain-text map of the site for a
 * language model — what Sketchbook is, its pages, the studio tour's sections
 * and every sketch, each with an absolute link.
 *
 * Built from the sources the site already renders, never written by hand:
 * the site identity (`config/site.ts`), the home page's tour
 * (`STUDIO_FEATURES`, the same list its sections and JSON-LD read), and the
 * sketch catalogue (`metadata.json`, filtered like `sitemap.ts`). A sketch
 * added, hidden or renamed changes this file on the next build.
 *
 * The rule that keeps it honest, pinned by `__tests__/llmsTxt.test.ts`: every
 * link here is a URL `/sitemap.xml` submits (a tour anchor counts as the home
 * page). That is why the engine listings (`/sketches/<engine>`), absent from
 * the sitemap, are absent here too.
 */
import {
  HOME_DESCRIPTION,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SOURCE_URL
} from "@/config/site";
import {
  ENGINE_CATALOG,
  getEngineLabel
} from "@/engines/engineCatalog";
import type {
  SketchMetadata
} from "@/engines/types";
import type {
  StudioFeature
} from "@/components/StudioFeatures/features";
import {
  buildCanonicalPath,
  formatSketchTitle
} from "@/lib/seo";

export type LlmsTxtInput = {
  /** Absolute origin, no trailing slash (`getBaseUrl()`). */
  baseUrl: string;
  /** The sketches the sitemap submits (`listIndexableSketches()`). */
  sketches: SketchMetadata[];
  /** The home page's studio tour. */
  features: StudioFeature[];
};

/** One `- [Title](url): note` line; the note is dropped when empty. */
function entry(
  title: string,
  url: string,
  note?: string
): string {
  const clean = note?.replace(
    /\s+/g,
    " "
  ).trim();

  return clean ? `- [${ title }](${ url }): ${ clean }` : `- [${ title }](${ url })`;
}

/** Engine catalogue order first, then series, then name. */
function compareSketches(
  a: SketchMetadata,
  b: SketchMetadata
): number {
  const order = ( engine: string ) => {
    const index = ENGINE_CATALOG.findIndex( ( e ) => e.id === engine );

    return index === -1 ? ENGINE_CATALOG.length : index;
  };

  return order( a.engine ) - order( b.engine ) ||
    ( a.category ?? "" ).localeCompare( b.category ?? "" ) ||
    a.name.localeCompare( b.name );
}

/** What a sketch is: its own `about.json` description when it has one. */
function sketchNote( sketch: SketchMetadata ): string {
  if ( sketch.description ) {
    return sketch.description;
  }

  const engine = getEngineLabel( sketch.engine );

  return sketch.category
    ? `${ engine } sketch, series ${ formatSketchTitle( sketch.category ) }.`
    : `${ engine } sketch.`;
}

export function buildLlmsTxt( {
  baseUrl, sketches, features
}: LlmsTxtInput ): string {
  const lines: string[] = [
    `# ${ SITE_NAME }`,
    "",
    `> ${ SITE_DESCRIPTION }`,
    "",
    `${ HOME_DESCRIPTION } Made by ${ SITE_AUTHOR }; the source is open at ${ SOURCE_URL }. Every sketch page opens the studio on that sketch, with its parameters in a generated form.`,
    "",
    "## Pages",
    "",
    entry(
      "Home",
      `${ baseUrl }/`,
      "What the studio does, surface by surface, with screenshots of each."
    ),
    entry(
      "Sketch library",
      `${ baseUrl }/sketches`,
      `Every sketch, by engine (${ ENGINE_CATALOG.map( ( e ) => e.label ).join( ", " ) }).`
    ),
    entry(
      "Site map",
      `${ baseUrl }/sitemap`,
      "Every page in one list, sketches grouped by series."
    ),
    entry(
      "Legal notice",
      `${ baseUrl }/legal`,
      "Who publishes and hosts the site, what stays in the browser, what a recording sends, what the audience measurement counts."
    ),
    "",
    "## The studio",
    "",
    ...features.map( ( feature ) => entry(
      feature.title,
      `${ baseUrl }/#${ feature.id }`,
      feature.summary
    ) ),
    "",
    `## Sketches (${ sketches.length })`,
    "",
    ...[
      ...sketches
    ].sort( compareSketches ).map( ( sketch ) => entry(
      formatSketchTitle( sketch.name ),
      `${ baseUrl }${ buildCanonicalPath(
        sketch.engine,
        sketch.name,
        sketch.category
      ) }`,
      sketchNote( sketch )
    ) ),
    ""
  ];

  return lines.join( "\n" );
}
