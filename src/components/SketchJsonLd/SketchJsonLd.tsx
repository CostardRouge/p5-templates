import {
  buildCanonicalPath,
  buildThumbnailUrl,
  formatSketchTitle,
  getBaseUrl,
  getSketchJsonLd
} from "@/lib/seo";

interface SketchJsonLdProps {
  sketchName: string;
  engineId: string;
  engineLabel: string;
  category: string | null;
  hasThumbnail: boolean;
}

export default function SketchJsonLd( {
  sketchName,
  engineId,
  engineLabel,
  category,
  hasThumbnail
}: SketchJsonLdProps ) {
  const baseUrl = getBaseUrl();
  const title = formatSketchTitle( sketchName );
  const canonicalPath = buildCanonicalPath(
    engineId,
    sketchName,
    category
  );
  const thumbnailUrl = hasThumbnail
    ? buildThumbnailUrl(
      engineId,
      sketchName,
      baseUrl
    )
    : undefined;

  const jsonLd = getSketchJsonLd( {
    title,
    engineLabel,
    url: `${ baseUrl }${ canonicalPath }`,
    thumbnailUrl
  } );

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={ {
        __html: JSON.stringify( jsonLd )
      } }
    />
  );
}
