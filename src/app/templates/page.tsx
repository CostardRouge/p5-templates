import type {
  Metadata
} from "next";
import {
  Suspense
} from "react";

import {
  buildOgTitle, getBaseUrl, SITE_NAME
} from "@/lib/seo";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd/BreadcrumbJsonLd";
import TemplatesList from "@/components/TemplatesList";
import {
  getTemplatesData
} from "./getTemplatesData";

const TITLE = "Templates";
const DESCRIPTION =
  "Browse all available social media templates. Choose from p5.js sketches, GSAP animations, and HTML templates to create stunning visual content.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/templates"
  },
  openGraph: {
    title: buildOgTitle( TITLE ),
    description: DESCRIPTION,
    url: "/templates",
    siteName: SITE_NAME,
    type: "website"
  }
};

export default async function TemplatesPage() {
  const {
    templatesByEngine, engineLabels
  } = await getTemplatesData();
  const baseUrl = getBaseUrl();

  const breadcrumbItems = [
    { name: "Home", url: baseUrl },
    { name: "Templates", url: `${ baseUrl }/templates` }
  ];

  return (
    <div className="p-3 sm:p-6">
      <BreadcrumbJsonLd items={ breadcrumbItems } />
      <Suspense>
        <TemplatesList
          templates={ templatesByEngine }
          engineLabels={ engineLabels }
          activeEngine="all"
        />
      </Suspense>
    </div>
  );
}
