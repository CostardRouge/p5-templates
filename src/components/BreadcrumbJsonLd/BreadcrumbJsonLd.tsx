import {
  getBreadcrumbJsonLd
} from "@/lib/seo";

interface BreadcrumbJsonLdProps {
  items: Array<{ name: string;
    url: string }>;
}

export default function BreadcrumbJsonLd( {
  items
}: BreadcrumbJsonLdProps ) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={ {
        __html: JSON.stringify( getBreadcrumbJsonLd( items ) )
      } }
    />
  );
}
