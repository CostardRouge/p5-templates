import type {
  Metadata
} from "next";
import {
  notFound
} from "next/navigation";
import {
  Suspense
} from "react";

import "@/engines/index";

import {
  hasEngine
} from "@/engines/registry";
import {
  getBaseUrl, SITE_NAME
} from "@/lib/seo";
import TemplatesList from "@/components/TemplatesList";
import {
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

  if ( !hasEngine( engine ) ) return {};

  const label = ( await getTemplatesData() ).engineLabels[ engine ] || engine;

  return {
    title: `${ label } Templates`,
    description: `Browse all ${ label } templates.`,
    alternates: {
      canonical: `/templates/${ engine }`
    },
    openGraph: {
      title: `${ label } Templates | ${ SITE_NAME }`,
      description: `Browse all ${ label } templates.`,
      url: `${ getBaseUrl() }/templates/${ engine }`,
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

  if ( !hasEngine( engine ) ) notFound();

  const {
    templatesByEngine, engineLabels
  } = await getTemplatesData();

  return (
    <div className="p-3 sm:p-6">
      <Suspense>
        <TemplatesList
          templates={ templatesByEngine }
          engineLabels={ engineLabels }
          activeEngine={ engine }
        />
      </Suspense>
    </div>
  );
}
