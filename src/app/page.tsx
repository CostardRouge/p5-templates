import type {
  Metadata
} from "next";
import {
  Suspense
} from "react";
import TemplatesList from "@/components/TemplatesList";

import {
  getBaseUrl, SITE_NAME
} from "@/lib/seo";
import getSketchThumbnailURL from "@/utils/getSketchThumbnailURL";
import getSketchList from "@/utils/getSketchList";

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Browse all available social media templates. Choose from p5.js sketches, GSAP animations, and HTML templates to create stunning visual content.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: `Templates | ${ SITE_NAME }`,
    description:
      "Browse all available social media templates. Choose from p5.js sketches, GSAP animations, and HTML templates.",
    url: `${ getBaseUrl() }/`,
    type: "website"
  }
};

export type TemplateCategory = Array<{
  href: string;
  name: string;
  thumbnail: string;
  hasSketchForm: boolean;
  category?: string | null;
}>;

export default async function TemplatesPage() {
  const p5sketches = ( await getSketchList() ) ?? [];

  const p5sketchNames = p5sketches
    .map( ( {
      name, engine, category, hasSketchForm
    } ) => ( {
      thumbnail: getSketchThumbnailURL(
        engine,
        name
      ),
      href: category ? `/templates/${ engine }/${ category }/${ name }` : `/templates/${ engine }/${ name }`,
      hasSketchForm,
      name,
      category
    } ) )
    .reverse();

  const templates: Record<string, TemplateCategory> = {
    p5: p5sketchNames
  };

  return (
    <div className="p-3 sm:p-6">
      <Suspense>
        <TemplatesList templates={templates} />
      </Suspense>
    </div>
  );
}
