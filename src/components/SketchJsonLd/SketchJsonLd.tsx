import { getBaseUrl } from "@/lib/seo";

interface SketchJsonLdProps {
  sketchName: string;
  engineId: string;
  category: string | null;
  hasThumbnail: boolean;
}

export default function SketchJsonLd( {
  sketchName,
  engineId,
  category,
  hasThumbnail,
}: SketchJsonLdProps ) {
  const baseUrl = getBaseUrl();
  const title = sketchName
    .split( "-" )
    .map( ( w ) => w.charAt( 0 ).toUpperCase() + w.slice( 1 ) )
    .join( " " );
  const canonicalPath = category
    ? `/templates/${ engineId }/${ category }/${ sketchName }`
    : `/templates/${ engineId }/${ sketchName }`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: title,
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    description: `Create ${ title } content with ${ engineId }.`,
    url: `${ baseUrl }${ canonicalPath }`,
    ...( hasThumbnail && {
      screenshot: `${ baseUrl }/assets/images/templates/${ engineId }/${ sketchName }/thumbnail.jpeg`,
    } ),
  };

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify( jsonLd ) }}
    />
  );
}
