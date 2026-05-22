/**
 * Minimal HTML meta-tag parser used by the OpenGraph diagnostics page.
 *
 * Regex-based because this is a dev-only tool and we don't want to pull a
 * full HTML parser into the dependency tree. It handles the tags Next.js
 * emits (meta, link rel="canonical", title, JSON-LD scripts) and tolerates
 * single- or double-quoted attributes in any order.
 */

export type OgImage = {
  url: string;
  secureUrl?: string;
  type?: string;
  width?: string;
  height?: string;
  alt?: string;
};

export type ParsedMeta = {
  title: string | null;
  general: {
    description: string | null;
    canonical: string | null;
    keywords: string | null;
    author: string | null;
    robots: string | null;
    themeColor: string | null;
    viewport: string | null;
    generator: string | null;
  };
  openGraph: {
    title: string | null;
    description: string | null;
    type: string | null;
    url: string | null;
    siteName: string | null;
    locale: string | null;
    images: OgImage[];
  };
  twitter: {
    card: string | null;
    title: string | null;
    description: string | null;
    images: string[];
    site: string | null;
    creator: string | null;
  };
  jsonLd: unknown[];
  rawMeta: Array<{ key: string;
    value: string;
    source: "name" | "property" | "http-equiv" }>;
};

function stripHtml( html: string ): string {
  // Remove script/style blocks so meta tags inside them don't confuse us
  return html
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      ""
    );
}

function getAttr(
  tag: string, attr: string
): string | null {
  const re = new RegExp(
    `\\b${ attr }\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i"
  );
  const m = tag.match( re );

  if ( !m ) {
    return null;
  }

  return ( m[ 1 ] ?? m[ 2 ] ?? m[ 3 ] ?? "" ).trim();
}

function decodeEntities( s: string ): string {
  return s
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&lt;/g,
      "<"
    )
    .replace(
      /&gt;/g,
      ">"
    )
    .replace(
      /&quot;/g,
      "\""
    )
    .replace(
      /&#39;/g,
      "'"
    )
    .replace(
      /&#x27;/g,
      "'"
    )
    .replace(
      /&apos;/g,
      "'"
    );
}

export function parseMeta( html: string ): ParsedMeta {
  const result: ParsedMeta = {
    title: null,
    general: {
      description: null,
      canonical: null,
      keywords: null,
      author: null,
      robots: null,
      themeColor: null,
      viewport: null,
      generator: null
    },
    openGraph: {
      title: null,
      description: null,
      type: null,
      url: null,
      siteName: null,
      locale: null,
      images: []
    },
    twitter: {
      card: null,
      title: null,
      description: null,
      images: [],
      site: null,
      creator: null
    },
    jsonLd: [],
    rawMeta: []
  };

  // ── <title> ───────────────────────────────────────────────────────────
  const titleMatch = html.match( /<title[^>]*>([\s\S]*?)<\/title>/i );

  if ( titleMatch ) {
    result.title = decodeEntities( titleMatch[ 1 ].trim() );
  }

  // ── <link rel="canonical"> ────────────────────────────────────────────
  const linkRegex = /<link\b[^>]*>/gi;

  for ( const m of html.matchAll( linkRegex ) ) {
    const tag = m[ 0 ];
    const rel = getAttr(
      tag,
      "rel"
    );

    if ( rel && rel.toLowerCase() === "canonical" ) {
      result.general.canonical = getAttr(
        tag,
        "href"
      );
    }
  }

  // ── JSON-LD <script> blocks (run before stripHtml strips them) ────────
  const ldRegex =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for ( const m of html.matchAll( ldRegex ) ) {
    const raw = m[ 1 ].trim();

    if ( !raw ) {
      continue;
    }

    try {
      result.jsonLd.push( JSON.parse( raw ) );
    } catch {
      result.jsonLd.push( {
        _parseError: true,
        raw: raw.slice(
          0,
          400
        )
      } );
    }
  }

  // ── <meta> tags ───────────────────────────────────────────────────────
  const head = stripHtml( html );
  const metaRegex = /<meta\b[^>]*>/gi;
  const ogImageBucket: OgImage = {
    url: ""
  };
  const ogImages: OgImage[] = [];

  function flushOgImage() {
    if ( ogImageBucket.url ) {
      ogImages.push( {
        ...ogImageBucket
      } );
    }
    ogImageBucket.url = "";
    ogImageBucket.secureUrl = undefined;
    ogImageBucket.type = undefined;
    ogImageBucket.width = undefined;
    ogImageBucket.height = undefined;
    ogImageBucket.alt = undefined;
  }

  for ( const m of head.matchAll( metaRegex ) ) {
    const tag = m[ 0 ];
    const name = getAttr(
      tag,
      "name"
    );
    const property = getAttr(
      tag,
      "property"
    );
    const httpEquiv = getAttr(
      tag,
      "http-equiv"
    );
    const content = getAttr(
      tag,
      "content"
    );

    if ( content == null ) {
      continue;
    }

    const value = decodeEntities( content );
    const key = ( property ?? name ?? httpEquiv ?? "" ).toLowerCase();

    if ( !key ) {
      continue;
    }

    result.rawMeta.push( {
      key,
      value,
      source: property ? "property" : name ? "name" : "http-equiv"
    } );

    // OpenGraph
    if ( key.startsWith( "og:" ) ) {
      switch ( key ) {
        case "og:title":
          result.openGraph.title = value;
          break;
        case "og:description":
          result.openGraph.description = value;
          break;
        case "og:type":
          result.openGraph.type = value;
          break;
        case "og:url":
          result.openGraph.url = value;
          break;
        case "og:site_name":
          result.openGraph.siteName = value;
          break;
        case "og:locale":
          result.openGraph.locale = value;
          break;
        case "og:image":
        case "og:image:url":
        // New image starts here — flush the previous bucket
          flushOgImage();
          ogImageBucket.url = value;
          break;
        case "og:image:secure_url":
          ogImageBucket.secureUrl = value;
          break;
        case "og:image:type":
          ogImageBucket.type = value;
          break;
        case "og:image:width":
          ogImageBucket.width = value;
          break;
        case "og:image:height":
          ogImageBucket.height = value;
          break;
        case "og:image:alt":
          ogImageBucket.alt = value;
          break;
      }
      continue;
    }

    // Twitter
    if ( key.startsWith( "twitter:" ) ) {
      switch ( key ) {
        case "twitter:card":
          result.twitter.card = value;
          break;
        case "twitter:title":
          result.twitter.title = value;
          break;
        case "twitter:description":
          result.twitter.description = value;
          break;
        case "twitter:image":
          result.twitter.images.push( value );
          break;
        case "twitter:site":
          result.twitter.site = value;
          break;
        case "twitter:creator":
          result.twitter.creator = value;
          break;
      }
      continue;
    }

    // General
    switch ( key ) {
      case "description":
        result.general.description = value;
        break;
      case "keywords":
        result.general.keywords = value;
        break;
      case "author":
        result.general.author = value;
        break;
      case "robots":
        result.general.robots = value;
        break;
      case "theme-color":
        result.general.themeColor = value;
        break;
      case "viewport":
        result.general.viewport = value;
        break;
      case "generator":
        result.general.generator = value;
        break;
    }
  }

  flushOgImage();
  result.openGraph.images = ogImages;

  return result;
}
