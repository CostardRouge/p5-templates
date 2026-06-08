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
import TemplatesList from "@/components/TemplatesList";
import {
  filterTemplatesForGallery,
  getTemplatesData
} from "../getTemplatesData";

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

  const label = ( await getTemplatesData() ).engineLabels[ engine ] || engine;
  const title = `${ label } Templates`;
  const description = `Browse all ${ label } templates. Create stunning social media visuals with ${ label }.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/templates/${ engine }`
    },
    openGraph: {
      title: buildOgTitle( title ),
      description,
      url: `/templates/${ engine }`,
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
    templatesByEngine, engineLabels
  } = await getTemplatesData();

  const label = engineLabels[ engine ] || engine;
  const baseUrl = getBaseUrl();

  const breadcrumbItems = [
    {
      name: "Home",
      url: baseUrl
    },
    {
      name: "Templates",
      url: `${ baseUrl }/templates`
    },
    {
      name: `${ label } Templates`,
      url: `${ baseUrl }/templates/${ engine }`
    }
  ];

  return (
    <div className="p-3 sm:p-6">
      <BreadcrumbJsonLd items={ breadcrumbItems } />
      <Suspense>
        <TemplatesList
          templates={ filterTemplatesForGallery( templatesByEngine ) }
          engineLabels={ engineLabels }
          activeEngine={ engine }
        />
      </Suspense>
    </div>
  );
}
