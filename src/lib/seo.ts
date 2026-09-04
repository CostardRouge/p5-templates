import {
  APP_FEATURE_LIST,
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL
} from "@/config/site";

// Re-export all site constants so existing imports keep working
export {
  APP_FEATURE_LIST,
  HOME_DESCRIPTION,
  OG_IMAGE,
  SITE_AUTHOR,
  SITE_CATEGORY,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_TAGLINE,
  SITE_URL,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT
} from "@/config/site";

/**
 * Origin every canonical, OG url, JSON-LD id and sitemap `<loc>` is built on.
 *
 * `NEXT_PUBLIC_SITE_URL` first, then Vercel's own host, then a **build-time**
 * decision: a production build falls back to `SITE_URL`, everything else to
 * localhost. The last step is the load-bearing one.
 *
 * Why it cannot be an env var alone: `NEXT_PUBLIC_*` is read when the route is
 * rendered, and the statically prerendered routes (`/`, `/sketches`, `/sitemap`,
 * `/sitemap.xml`, `/robots.txt`) are rendered at BUILD time. Setting the var on
 * the running container is too late for them — only the dynamic sketch routes
 * pick it up. `.github/workflows/docker-build.yml` does not pass it as a build
 * arg, so the published image shipped `http://localhost:3000` as the canonical
 * of its home page and in every `<loc>` of its sitemap: an instruction to search
 * engines not to index the real URLs.
 *
 * Keeping the fallback out of development matters too — a dev server must keep
 * minting localhost share links, embed URLs and QR codes.
 */
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    ( process.env.VERCEL_URL
      ? `https://${ process.env.VERCEL_URL }`
      : "" ) ||
    ( process.env.NODE_ENV === "production" ? SITE_URL : "http://localhost:3000" )
  );
}

// ─── String utilities ─────────────────────────────────────────────────────────

/** Converts a kebab-case sketch name to Title Case: "photo-balloons" → "Photo Balloons". */
export function formatSketchTitle( sketchName: string ): string {
  return sketchName
    .split( "-" )
    .map( ( w ) => w.charAt( 0 ).toUpperCase() + w.slice( 1 ) )
    .join( " " );
}

/** Builds a full OG/Twitter title: "{pageTitle} | {SITE_NAME}". */
export function buildOgTitle( pageTitle: string ): string {
  return `${ pageTitle } | ${ SITE_NAME }`;
}

// ─── Sketch page utilities ────────────────────────────────────────────────────

/** Returns the canonical URL path for a sketch. */
export function buildCanonicalPath(
  engineId: string,
  sketchName: string,
  category?: string | null
): string {
  return category
    ? `/sketches/${ engineId }/${ category }/${ sketchName }`
    : `/sketches/${ engineId }/${ sketchName }`;
}

/** Returns the absolute thumbnail URL for a sketch. */
export function buildThumbnailUrl(
  engineId: string,
  sketchName: string,
  baseUrl: string
): string {
  return `${ baseUrl }/assets/images/templates/${ engineId }/${ sketchName }/thumbnail.webp`;
}

/** Builds the meta description for a sketch detail page. */
export function buildSketchDescription(
  sketchTitle: string,
  engineLabel: string
): string {
  return `Create ${ sketchTitle } content with ${ engineLabel }. A customizable creative-coding sketch.`;
}

/** Builds the keyword list for a sketch detail page. */
export function buildSketchKeywords(
  sketchName: string,
  engineLabel: string
): string[] {
  const title = formatSketchTitle( sketchName );

  return [
    title,
    engineLabel,
    "creative coding sketch",
    "video generator",
    "creative coding",
    ...sketchName.split( "-" )
  ];
}

// ─── Share / embed page utilities ─────────────────────────────────────────────

/** Page title for a shared sketch link: "Photo Balloons — Shared Sketch". */
export function buildShareTitle( sketchTitle: string ): string {
  return `${ sketchTitle } — Shared Sketch`;
}

/** Meta description for a shared sketch link (the /embed view). */
export function buildShareDescription(
  sketchTitle: string,
  engineLabel: string
): string {
  return `${ sketchTitle } — a creative-coding sketch shared from ${ SITE_NAME }. Watch it render live in your browser, powered by ${ engineLabel }.`;
}

// ─── JSON-LD generators ───────────────────────────────────────────────────────

/** WebApplication schema for the root layout. */
export function getWebApplicationJsonLd() {
  const baseUrl = getBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: baseUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    featureList: APP_FEATURE_LIST,
    screenshot: `${ baseUrl }${ OG_IMAGE.path }`
  };
}

/** SoftwareApplication schema for an individual sketch page. */
export function getSketchJsonLd( {
  title,
  engineLabel,
  url,
  thumbnailUrl
}: {
  title: string;
  engineLabel: string;
  url: string;
  thumbnailUrl?: string;
} ) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: title,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    description: buildSketchDescription(
      title,
      engineLabel
    ),
    url,
    ...( thumbnailUrl && {
      screenshot: thumbnailUrl
    } )
  };
}

/** BreadcrumbList schema for navigation hierarchy. */
export function getBreadcrumbJsonLd( items: Array<{ name: string;
  url: string }> ) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map( (
      item, index
    ) => ( {
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    } ) )
  };
}
