import type {
  Metadata
} from "next";
import TemplatesList from "@/components/TemplatesList";
import {
  getAllTemplates
} from "@/lib/gsap/templateRegistry";
import {
  getBaseUrl, SITE_NAME
} from "@/lib/seo";
import getP5SketchThumbnailURL from "@/utils/getP5SketchThumbnailURL";
import getSketchList from "@/utils/getSketchList";

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Browse all available social media templates. Choose from p5.js sketches, GSAP animations, and HTML templates to create stunning visual content.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `Templates | ${ SITE_NAME }`,
    description:
      "Browse all available social media templates. Choose from p5.js sketches, GSAP animations, and HTML templates.",
    url: `${ getBaseUrl() }/`,
    type: "website",
  },
};

export type TemplateCategory = Array<{
  href: string;
  name: string;
  thumbnail: string;
  hasSketchForm: boolean;
  category?: string | null;
}>;

export default async function TemplatesPage() {
  const p5sketches = ( await getSketchList() ) ?? [
  ];

  const p5sketchNames = p5sketches
    .map( ( {
      name, category, hasSketchForm
    } ) => ( {
      thumbnail: getP5SketchThumbnailURL( name ),
      href: `/p5/${ name }`,
      hasSketchForm,
      name,
      category,
    } ) )
    .reverse();

  // Get GSAP templates
  const gsapTemplates = getAllTemplates();
  const gsapTemplatesList = gsapTemplates.map( ( template ) => ( {
    thumbnail: template.thumbnail,
    href: `/gsap/${ template.id }`,
    hasSketchForm: false,
    name: template.name,
    category: template.category,
  } ) );

  const templates: Record<string, TemplateCategory> = {
    p5: p5sketchNames,
    gsap: gsapTemplatesList,
    html: [
      {
        thumbnail: "assets/images/templates/html/exif-detail/thumbnail.jpg",
        href: "/html/exif-detail",
        hasSketchForm: false,
        name: "exif-detail",
      },
    ],
  };

  return (
    <div className="p-3 sm:p-6">
      <TemplatesList templates={templates} />
    </div>
  );
}
