/**
 * Centralized SEO configuration for the application.
 * All metadata, OpenGraph defaults, and structured data helpers live here.
 */

export const SITE_NAME = "Coded templates";
export const SITE_DESCRIPTION =
  "Create stunning videos and images from customizable p5.js, GSAP, and HTML templates. Record, export, and share animated content for Instagram, TikTok, and more.";
export const SITE_KEYWORDS = [
  "code templates",
  "social media templates",
  "video generator",
  "p5.js",
  "GSAP animation",
  "creative coding",
  "social media content",
  "video recording",
  "animation templates",
  "Instagram templates",
  "TikTok templates",
  "generative art",
  "motion graphics",
  "HTML templates",
  "video export",
  "content creation tool",
];

/**
 * Returns the base URL for the site from environment variables.
 */
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    ( process.env.VERCEL_URL
      ? `https://${ process.env.VERCEL_URL }`
      : "http://localhost:3000" )
  );
}

/**
 * Generates a WebApplication JSON-LD structured data object.
 */
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
      priceCurrency: "USD",
    },
    featureList: [
      "p5.js template rendering",
      "GSAP animation templates",
      "HTML template capture",
      "Video recording and export",
      "Customizable sketch options",
      "EXIF data overlay",
      "Multiple export formats",
    ],
    screenshot: `${ baseUrl }/assets/images/icon-512x512.png`,
  };
}

/**
 * Generates a BreadcrumbList JSON-LD structured data object.
 */
export function getBreadcrumbJsonLd( items: Array<{
 name: string; url: string
}> ) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map( (
      item, index
    ) => ( {
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    } ) ),
  };
}

/**
 * Generates a CreativeWork JSON-LD for an individual template.
 */
export function getTemplateJsonLd( {
  name,
  description,
  url,
  thumbnailUrl,
  category,
}: {
  name: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  category: string;
} ) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description,
    url,
    thumbnailUrl,
    genre: category,
    isAccessibleForFree: true,
    provider: {
      "@type": "WebApplication",
      name: SITE_NAME,
    },
  };
}
