/**
 * A caption as PILLS (lab 4, his yes 2026-11-15): a template is text with
 * `{key}` or `{key|option=value|…}` tokens — the grammar of the `{title}`
 * templates kept since 2026-11-10, so every stored caption reads unchanged —
 * each token one element of the sketch, the piece, the post or his own words.
 *
 * One text is shared by every account; each account receives it FITTED to
 * its network (`composeCaption`): hashtags once and within the network's
 * count, the link said as «link in bio» where a caption link is not
 * clickable, then — only when it is still too long — a long text cut at a
 * sentence, the minor pills dropped, a word cut. The notes say what was done.
 *
 * Pure: a template, the facts, a clock and a network in; words out.
 */

import {
  CAPTION_LIMIT, type Provider
} from "./client";
import type {
  CaptionFacts
} from "./caption";

/** What the catalogue, the export and the sends add to `CaptionFacts`; every field optional (empty = the pill folds away). */
export interface PillFacts extends CaptionFacts {
  /** `Iridescent`. */
  category?: string;
  /** `iridescent` — the category's slug. */
  categorySlug?: string;
  /** 7, from `-v7`. */
  version?: number | null;
  /** Its place among the category's sketches, and how many there are. */
  rank?: number | null;
  of?: number | null;
  /** When the sketch was made, ISO. */
  created?: string | null;
  /** `30`. */
  fps?: string;
  /** How many slides the export covers. */
  slides?: number;
  /** This send's number among his Sketchbook sends, and among this category's. */
  postNo?: number | null;
  catNo?: number | null;
  /** His line about this sketch, kept with it. */
  note?: string;
}

/** A phrase he writes once and uses in any caption (Publishing keeps them). */
export interface Phrase {
  id: string;
  name: string;
  text: string;
}

export const DEFAULT_PHRASES: Phrase[] = [
  {
    id: "house",
    name: "House tags",
    text: "#generativeart #creativecoding"
  },
  {
    id: "inbio",
    name: "Link in bio",
    text: "Full loop: link in bio"
  },
  {
    id: "sign",
    name: "Signature",
    text: "Made with Sketchbook"
  }
];

export interface PillContext {
  facts: PillFacts;
  /** When it goes out (now when sent now, null for a draft). */
  at: Date | null;
  timeZone: string;
  /** Day 1 of «Day N», `YYYY-MM-DD`, or null. */
  dayStart: string | null;
  phrases: readonly Phrase[];
}

export type PillFamily = "sketch" | "piece" | "post" | "mine";
export type PillOption = "fmt" | "count" | "case" | "inbio" | "start";

export interface PillDef {
  key: string;
  family: PillFamily;
  label: string;
  /** Where the value comes from, for the options popover. */
  source: string;
  options?: PillOption[];
  /** Its value holds hashtags: deduplicated and counted with the others. */
  tags?: boolean;
  /** A long text: cut at a sentence, or dropped, when the network's limit asks. */
  cut?: boolean;
  /** A detail: dropped (last first) before a word is cut. */
  minor?: boolean;
  /** Kept for the templates written before the pills; not offered in the palette. */
  hidden?: boolean;
  value: ( ctx: PillContext, opts: Readonly<Record<string, string>> ) => string;
}

export type Segment = { text: string } | { pill: string;
  opts: Record<string, string> };

export const PILL_FAMILY_LABEL: Record<PillFamily, string> = {
  sketch: "The sketch",
  piece: "The piece",
  post: "The post",
  mine: "My words"
};

/** Hashtags each network keeps: Instagram's cap, YouTube ignores them all past 15, one topic on Threads, two on X by taste. */
export const HASHTAG_CAP: Record<Provider, number> = {
  instagram: 30,
  tiktok: Infinity,
  youtube: 15,
  threads: 1,
  x: 2,
  bluesky: Infinity,
  other: Infinity
};

/** Networks where a link in a caption is not clickable: the link pill says the «Link in bio» phrase there. */
export const IN_BIO: ReadonlySet<Provider> = new Set( [
  "instagram",
  "tiktok"
] );

/** «Before more»: how much of a caption a network shows folded. */
export const FOLD: Partial<Record<Provider, number>> = {
  instagram: 125,
  tiktok: 100,
  youtube: 100
};

const HASHTAG = /#(?=[\p{N}_]*\p{L})[\p{L}\p{N}_]+/gu;
const URL = /\b[\w-]+(\.[\w-]+)+\/\S*/g;

function hashtagsOf( words: readonly string[] ): string {
  return [
    ...new Set( words.map( ( t ) => t.toLowerCase().replace(
      /[^\p{L}\p{N}_]/gu,
      ""
    ) ).filter( Boolean ) )
  ].map( ( t ) => `#${ t }` )
    .join( " " );
}

function inZone(
  at: Date, timeZone: string, part: Intl.DateTimeFormatOptions
): string {
  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        ...part,
        timeZone
      }
    ).format( at );
  } catch {
    return new Intl.DateTimeFormat(
      "en-GB",
      part
    ).format( at );
  }
}

/** `15 Nov`, `Sunday 15 November`, `15/11/2026`, `November 2026` — in the rhythm's zone. */
export function formatDate(
  at: Date, fmt: string | undefined, timeZone: string
): string {
  switch ( fmt ) {
    case "long":
      return inZone(
        at,
        timeZone,
        {
          weekday: "long",
          day: "numeric",
          month: "long"
        }
      ).replace(
        ",",
        ""
      );
    case "num":
      return inZone(
        at,
        timeZone,
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }
      );
    case "month":
      return inZone(
        at,
        timeZone,
        {
          month: "long",
          year: "numeric"
        }
      );
    default:
      return inZone(
        at,
        timeZone,
        {
          day: "numeric",
          month: "short"
        }
      );
  }
}

function ordinal( n: number ): string {
  const tens = n % 100;

  if ( tens >= 11 && tens <= 13 ) {
    return `${ n }th`;
  }

  return `${ n }${ [
    "th",
    "st",
    "nd",
    "rd"
  ][ n % 10 ] ?? "th" }`;
}

const firstSentence = ( text: string ) => ( text.match( /^.*?[.!?](\s|$)/s )?.[ 0 ] ?? text ).trim();

const postDate = ( ctx: PillContext ) => ctx.at ?? new Date();

export const PILLS: PillDef[] = [
  {
    key: "title",
    family: "sketch",
    label: "Title",
    source: "the sketch’s name and category, its version dropped",
    options: [
      "case"
    ],
    value: (
      c, o
    ) => o.case === "upper" ? c.facts.title.toUpperCase() : c.facts.title
  },
  {
    key: "category",
    family: "sketch",
    label: "Category",
    source: "the catalogue",
    value: ( c ) => c.facts.category ?? ""
  },
  {
    key: "categoryTag",
    family: "sketch",
    label: "Category #",
    source: "the catalogue",
    tags: true,
    value: ( c ) => c.facts.categorySlug ? hashtagsOf( [
      c.facts.categorySlug
    ] ) : ""
  },
  {
    key: "version",
    family: "sketch",
    label: "Version",
    source: "the sketch’s name (-vN)",
    minor: true,
    value: ( c ) => c.facts.version ? `v${ c.facts.version }` : ""
  },
  {
    key: "rank",
    family: "sketch",
    label: "Rank in series",
    source: "the catalogue, by version",
    minor: true,
    value: ( c ) => c.facts.rank && c.facts.of && c.facts.category ? `${ ordinal( c.facts.rank ) } of ${ c.facts.of } in ${ c.facts.category }` : ""
  },
  {
    key: "description",
    family: "sketch",
    label: "Description",
    source: "the catalogue (few sketches have one)",
    cut: true,
    value: ( c ) => c.facts.description
  },
  {
    key: "descriptionFirst",
    family: "sketch",
    label: "First sentence",
    source: "the catalogue’s description",
    cut: true,
    value: ( c ) => c.facts.description ? firstSentence( c.facts.description ) : ""
  },
  {
    key: "tags",
    family: "sketch",
    label: "Tags",
    source: "the catalogue (few sketches have them)",
    tags: true,
    options: [
      "count"
    ],
    value: (
      c, o
    ) => {
      const all = c.facts.tags.split( /\s+/ ).filter( Boolean );
      const n = Number( o.count );

      return ( Number.isFinite( n ) && n > 0 ? all.slice(
        0,
        n
      ) : all ).join( " " );
    }
  },
  {
    key: "engine",
    family: "sketch",
    label: "Engine",
    source: "the catalogue",
    minor: true,
    value: ( c ) => c.facts.engine
  },
  {
    key: "engineTag",
    family: "sketch",
    label: "Engine #",
    source: "the catalogue",
    tags: true,
    value: ( c ) => c.facts.engine ? hashtagsOf( [
      c.facts.engine.replace(
        /\.js$/i,
        "js"
      )
    ] ) : ""
  },
  {
    key: "created",
    family: "sketch",
    label: "Made on",
    source: "when the sketch was made",
    options: [
      "fmt"
    ],
    minor: true,
    value: (
      c, o
    ) => {
      const at = c.facts.created ? new Date( c.facts.created ) : null;

      return at && !Number.isNaN( at.getTime() ) ? formatDate(
        at,
        o.fmt,
        c.timeZone
      ) : "";
    }
  },
  {
    key: "link",
    family: "sketch",
    label: "Link",
    source: "the sketch’s page",
    options: [
      "inbio"
    ],
    value: ( c ) => c.facts.link
  },
  {
    key: "loop",
    family: "piece",
    label: "Loop",
    source: "the export’s duration",
    minor: true,
    value: ( c ) => c.facts.seconds ? `a ${ c.facts.seconds } s loop` : ""
  },
  {
    key: "fps",
    family: "piece",
    label: "Frame rate",
    source: "the sketch’s frame rate",
    minor: true,
    value: ( c ) => c.facts.fps ? `${ c.facts.fps } fps` : ""
  },
  {
    key: "slides",
    family: "piece",
    label: "Slides",
    source: "the document",
    minor: true,
    value: ( c ) => ( c.facts.slides ?? 1 ) > 1 ? `${ c.facts.slides } slides` : ""
  },
  {
    key: "date",
    family: "post",
    label: "Date",
    source: "when it goes out",
    options: [
      "fmt"
    ],
    minor: true,
    value: (
      c, o
    ) => formatDate(
      postDate( c ),
      o.fmt,
      c.timeZone
    )
  },
  {
    key: "weekday",
    family: "post",
    label: "Weekday",
    source: "when it goes out",
    minor: true,
    value: ( c ) => inZone(
      postDate( c ),
      c.timeZone,
      {
        weekday: "long"
      }
    )
  },
  {
    key: "season",
    family: "post",
    label: "Season",
    source: "when it goes out",
    minor: true,
    value: ( c ) => {
      const at = postDate( c );
      const month = Number( inZone(
        at,
        c.timeZone,
        {
          month: "numeric"
        }
      ) );
      const year = inZone(
        at,
        c.timeZone,
        {
          year: "numeric"
        }
      );

      return `${ [
        "Winter",
        "Winter",
        "Spring",
        "Spring",
        "Spring",
        "Summer",
        "Summer",
        "Summer",
        "Autumn",
        "Autumn",
        "Autumn",
        "Winter"
      ][ month - 1 ] } ${ year }`;
    }
  },
  {
    key: "postNo",
    family: "post",
    label: "Post #",
    source: "your Sketchbook sends from this browser, counted",
    value: ( c ) => c.facts.postNo ? `Sketchbook #${ c.facts.postNo }` : ""
  },
  {
    key: "catNo",
    family: "post",
    label: "Category #",
    source: "your sends of this category from this browser",
    value: ( c ) => c.facts.catNo && c.facts.category ? `${ c.facts.category } #${ c.facts.catNo }` : ""
  },
  {
    key: "dayN",
    family: "post",
    label: "Day N",
    source: "a day 1 you set in the pill’s options",
    options: [
      "start"
    ],
    value: ( c ) => {
      if ( !c.dayStart || !/^\d{4}-\d{2}-\d{2}$/.test( c.dayStart ) ) {
        return "";
      }

      const day = inZone(
        postDate( c ),
        c.timeZone,
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).split( "/" )
        .reverse()
        .join( "-" );
      const n = Math.round( ( Date.parse( `${ day }T00:00:00Z` ) - Date.parse( `${ c.dayStart }T00:00:00Z` ) ) / 864e5 ) + 1;

      return n >= 1 ? `Day ${ n }` : "";
    }
  },
  {
    key: "note",
    family: "mine",
    label: "My note",
    source: "a line you keep with this sketch",
    cut: true,
    value: ( c ) => c.facts.note ?? ""
  },
  {
    key: "sketch",
    family: "sketch",
    label: "Sketch name",
    source: "the catalogue",
    value: ( c ) => c.facts.sketch
  },
  {
    key: "seconds",
    family: "piece",
    label: "Seconds",
    source: "the export’s duration",
    hidden: true,
    value: ( c ) => c.facts.seconds
  }
];

const BY_KEY = new Map( PILLS.map( ( p ) => [
  p.key,
  p
] ) );

/** A pill by key — `phrase:<id>` for one of his phrases — or undefined. */
export function pillDef(
  key: string, phrases: readonly Phrase[]
): PillDef | undefined {
  if ( key.startsWith( "phrase:" ) ) {
    const phrase = phrases.find( ( p ) => `phrase:${ p.id }` === key );

    return phrase ? {
      key,
      family: "mine",
      label: phrase.name || "Phrase",
      source: "your phrase, kept in Publishing",
      tags: /^\s*(#\S+\s*)+$/.test( phrase.text ),
      value: () => phrase.text
    } : undefined;
  }

  return BY_KEY.get( key );
}

/** Every pill the palette offers, his phrases last. */
export function paletteOf( phrases: readonly Phrase[] ): PillDef[] {
  return [
    ...PILLS.filter( ( p ) => !p.hidden ),
    ...phrases.map( ( p ) => pillDef(
      `phrase:${ p.id }`,
      phrases
    ) as PillDef )
  ];
}

/** A template's text and pills. An unknown token stays text, as typed. */
export function parseTemplate( template: string ): Segment[] {
  const out: Segment[] = [];
  const re = /\{([\w:-]+)((?:\|[\w-]+=[^|{}]*)*)\}/g;
  let last = 0;

  for ( const m of template.matchAll( re ) ) {
    if ( m.index > last ) {
      out.push( {
        text: template.slice(
          last,
          m.index
        )
      } );
    }

    const opts: Record<string, string> = {};

    for ( const part of m[ 2 ].split( "|" ).filter( Boolean ) ) {
      const eq = part.indexOf( "=" );

      opts[ part.slice(
        0,
        eq
      ) ] = part.slice( eq + 1 );
    }

    out.push( {
      pill: m[ 1 ],
      opts
    } );
    last = m.index + m[ 0 ].length;
  }

  if ( last < template.length ) {
    out.push( {
      text: template.slice( last )
    } );
  }

  return out;
}

export function serializeTemplate( segments: readonly Segment[] ): string {
  return segments.map( ( s ) => "text" in s
    ? s.text
    : `{${ s.pill }${ Object.entries( s.opts ).filter( ( [
      , v
    ] ) => v !== "" )
      .map( ( [
        k,
        v
      ] ) => `|${ k }=${ v.replace(
        /[|{}]/g,
        ""
      ) }` )
      .join( "" ) }}` ).join( "" );
}

/** A caption's length as the network counts it: X counts a link as 23. */
export function captionLength(
  text: string, provider: Provider | null
): number {
  if ( provider === "x" ) {
    let links = 0;
    const rest = text.replace(
      URL,
      () => {
        links += 1;

        return "";
      }
    );

    return [
      ...rest
    ].length + links * 23;
  }

  return [
    ...text
  ].length;
}

interface Part {
  text: string;
  def?: PillDef;
}

const SEPARATOR = /[\s·—\-–:|,]/g;

function cleanLine( text: string ): string {
  return text
    .replace(
      /\s*[·|]\s*(?=[·|]|$)/g,
      ""
    )
    .replace(
      /^\s*[·|]\s*/,
      ""
    )
    .replace(
      /[ \t]{2,}/g,
      " "
    )
    .trim();
}

function joinLines( lines: readonly Part[][] ): string {
  const out: string[] = [];

  for ( const parts of lines ) {
    const text = cleanLine( parts.map( ( p ) => p.text ).join( "" ) );
    const hadPill = parts.some( ( p ) => p.def );

    // A line whose pills are all empty folds away with its separators.
    if ( hadPill && !text.replace(
      SEPARATOR,
      ""
    ) ) {
      continue;
    }

    out.push( text );
  }

  return out.join( "\n" ).replace(
    /\n{3,}/g,
    "\n\n"
  )
    .trim();
}

/** Every pill's value for this post, as lines of parts; a pill hidden on this network is empty. */
function fill(
  segments: readonly Segment[], ctx: PillContext, provider: Provider | null
): Part[][] {
  const lines: Part[][] = [
    []
  ];

  for ( const s of segments ) {
    if ( "text" in s ) {
      s.text.split( "\n" ).forEach( (
        bit, i
      ) => {
        if ( i ) {
          lines.push( [] );
        }

        if ( bit ) {
          lines[ lines.length - 1 ].push( {
            text: bit
          } );
        }
      } );

      continue;
    }

    const def = pillDef(
      s.pill,
      ctx.phrases
    );

    if ( !def ) {
      lines[ lines.length - 1 ].push( {
        text: `{${ s.pill }}`
      } );

      continue;
    }

    const shown = !s.opts.nets || !provider || s.opts.nets.split( "," ).includes( provider );
    let text = shown ? def.value(
      ctx,
      s.opts
    ) : "";

    if ( shown && def.key === "link" && provider && IN_BIO.has( provider ) && s.opts.inbio !== "off" ) {
      text = ctx.phrases.find( ( p ) => p.id === "inbio" )?.text ?? "Link in bio";
    }

    // A value is one line: a description's own line breaks stay inside it.
    lines[ lines.length - 1 ].push( {
      text: text.replace(
        /\s*\n\s*/g,
        " "
      ),
      def
    } );
  }

  return lines;
}

export interface Composed {
  text: string;
  /** What was done for this network, in his words: `2 of 6 hashtags`, `description dropped`. */
  notes: string[];
  length: number;
  limit: number;
  over: boolean;
}

/**
 * The words one network receives (`provider` null: the shared text, nothing
 * fitted). Hashtags are kept once, in the text's order, within the network's
 * count; the rest only when the network's limit asks.
 */
export function composeCaption(
  template: string, ctx: PillContext, provider: Provider | null,
  /** False keeps the words as written: too long is then said, never cut. */
  fitWords = true
): Composed {
  const notes: string[] = [];
  const lines = fill(
    parseTemplate( template ),
    ctx,
    provider
  );
  const cap = provider ? HASHTAG_CAP[ provider ] : Infinity;
  const seen = new Set<string>();
  let kept = 0;

  for ( const parts of lines ) {
    for ( const p of parts ) {
      p.text = p.text.replace(
        HASHTAG,
        ( tag ) => {
          const key = tag.toLowerCase();

          if ( seen.has( key ) ) {
            return "";
          }

          seen.add( key );

          if ( kept < cap ) {
            kept += 1;

            return tag;
          }

          return "";
        }
      ).replace(
        / {2,}/g,
        " "
      );
    }
  }

  if ( seen.size > cap ) {
    notes.push( `${ cap } of ${ seen.size } hashtags` );
  }

  if ( !provider ) {
    const text = joinLines( lines );

    return {
      text,
      notes,
      length: captionLength(
        text,
        null
      ),
      limit: Infinity,
      over: false
    };
  }

  const limit = CAPTION_LIMIT[ provider ];
  const length = () => captionLength(
    joinLines( lines ),
    provider
  );

  for ( const p of lines.flat() ) {
    if ( !fitWords || length() <= limit ) {
      break;
    }

    if ( !p.def?.cut || !p.text ) {
      continue;
    }

    const room = limit - ( length() - captionLength(
      p.text,
      provider
    ) );
    let cut = "";

    for ( const sentence of p.text.match( /[^.!?]+[.!?]+(\s|$)/g ) ?? [
      p.text
    ] ) {
      if ( captionLength(
        ( cut + sentence ).trim(),
        provider
      ) > room ) {
        break;
      }

      cut += sentence;
    }

    cut = cut.trim();

    if ( cut.length >= 30 ) {
      p.text = cut;
      notes.push( `${ p.def.label.toLowerCase() } cut at a sentence` );
    } else {
      p.text = "";
      notes.push( `${ p.def.label.toLowerCase() } dropped` );
    }
  }

  for ( const p of lines.flat().filter( ( x ) => x.def?.minor && x.text )
    .reverse() ) {
    if ( !fitWords || length() <= limit ) {
      break;
    }

    p.text = "";
    notes.push( `${ p.def?.label.toLowerCase() } dropped` );
  }

  let text = joinLines( lines );

  // A word can be cut only where there is a space; one unbroken word stays over.
  if ( fitWords && text.includes( " " ) && captionLength(
    text,
    provider
  ) > limit ) {
    while ( captionLength(
      `${ text }…`,
      provider
    ) > limit && text.includes( " " ) ) {
      text = text.slice(
        0,
        text.lastIndexOf( " " )
      );
    }

    text = `${ text.trimEnd() }…`;
    notes.push( "cut at a word" );
  }

  const n = captionLength(
    text,
    provider
  );

  return {
    text,
    notes,
    length: n,
    limit,
    over: n > limit
  };
}

/** What the template holds that this sketch has nothing for (the dashed pills). */
export function emptyPills(
  template: string, ctx: PillContext
): string[] {
  return parseTemplate( template ).flatMap( ( s ) => {
    if ( "text" in s ) {
      return [];
    }

    const def = pillDef(
      s.pill,
      ctx.phrases
    );

    return def && !def.value(
      ctx,
      s.opts
    ) ? [
        s.pill
      ] : [];
  } );
}

/** Starting points offered above the text (lab 4): Sketchbook's own is the default caption. */
export const CAPTION_TEMPLATES: readonly { name: string;
  template: string }[] = [
  {
    name: "Minimal",
    template: "{title}\n{link}\n{categoryTag} {phrase:house}"
  },
  {
    name: "Series",
    template: "{catNo} · {title}\n{note}\n{descriptionFirst}\n\n{date|fmt=long} · {link}\n{phrase:sign}\n{categoryTag} {engineTag} {phrase:house}"
  },
  {
    name: "Story",
    template: "{dayN} — {title}\n{note}\n{tags|count=3}"
  }
];
