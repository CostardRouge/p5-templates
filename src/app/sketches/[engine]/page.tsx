import type {
  Metadata
} from "next";
import {
  notFound
} from "next/navigation";
import {
  Suspense
} from "react";

import {
  isKnownEngine
} from "@/engines/engineCatalog";
import {
  buildOgTitle, getBaseUrl, SITE_NAME
} from "@/lib/seo";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd/BreadcrumbJsonLd";
import SketchesList from "@/components/SketchesList";
import {
  filterSketchesForGallery,
  getSketchesData
} from "../getSketchesData";

type RouteParams = { engine: string };

export async function generateMetadata( {
  params
}: {
  params: Promise<RouteParams>;
} ): Promise<Metadata> {
  const {
    engine
  } = await params;

  if ( !isKnownEngine( engine ) ) {
    return {};
  }

  const label = ( await getSketchesData() ).engineLabels[ engine ] || engine;
  const title = `${ label } Templates`;
  const description = `Browse all ${ label } templates. Create stunning social media visuals with ${ label }.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/sketches/${ engine }`
    },
    openGraph: {
      title: buildOgTitle( title ),
      description,
      url: `/sketches/${ engine }`,
      siteName: SITE_NAME,
      type: "website"
    }
  };
}

export default async function EngineTemplatesPage( {
  params
}: {
  params: Promise<RouteParams>;
} ) {
  const {
    engine
  } = await params;

  if ( !isKnownEngine( engine ) ) {
    notFound();
  }

  const {
    sketchesByEngine, engineLabels
  } = await getSketchesData();

  const label = engineLabels[ engine ] || engine;
  const baseUrl = getBaseUrl();

  const breadcrumbItems = [
    {
      name: "Home",
      url: baseUrl
    },
    {
      name: "Templates",
      url: `${ baseUrl }/sketches`
    },
    {
      name: `${ label } Templates`,
      url: `${ baseUrl }/sketches/${ engine }`
    }
  ];

  return (
    <div className="p-3 sm:p-6">
      <BreadcrumbJsonLd items={ breadcrumbItems } />
      <Suspense>
        <SketchesList
          templates={ filterSketchesForGallery( sketchesByEngine ) }
          engineLabels={ engineLabels }
          activeEngine={ engine }
        />
      </Suspense>
    </div>
  );
}
