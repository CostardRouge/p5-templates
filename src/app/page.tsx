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
import {
  listEngines
} from "@/engines/index";

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
  const allSketches = ( await getSketchList() ) ?? [];

  const templatesByEngine: Record<string, TemplateCategory> = {};

  allSketches
    .slice()
    .reverse()
    .forEach( ( {
      name, engine, category, hasSketchForm
    } ) => {
      if ( !templatesByEngine[ engine ] ) {
        templatesByEngine[ engine ] = [];
      }

      templatesByEngine[ engine ].push( {
        thumbnail: getSketchThumbnailURL(
          engine,
          name
        ),
        href: category
          ? `/templates/${ engine }/${ category }/${ name }`
          : `/templates/${ engine }/${ name }`,
        hasSketchForm,
        name,
        category
      } );
    } );

  const engines = listEngines();
  const engineLabels: Record<string, string> = {};

  engines.forEach( ( e ) => {
    engineLabels[ e.id ] = e.label;
  } );

  return (
    <div className="p-3 sm:p-6">
      <Suspense>
        <TemplatesList templates={ templatesByEngine } engineLabels={ engineLabels } />
      </Suspense>
    </div>
  );
}
