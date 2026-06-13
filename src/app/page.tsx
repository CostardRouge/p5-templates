import type {
  Metadata
} from "next";
import HomePage from "@/components/HomePage";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd/BreadcrumbJsonLd";
import {
  buildOgTitle, getBaseUrl, SITE_DESCRIPTION, SITE_NAME
} from "@/lib/seo";
import {
  getTemplatesData
} from "./templates/getTemplatesData";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: buildOgTitle( "Home" ),
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website"
  }
};

export default async function Home() {
  const {
    templatesByEngine, engineLabels
  } = await getTemplatesData();

  const allTemplates = Object.values( templatesByEngine ).flat();

  // `.hidden-template` is the public gate — anything hidden from the gallery
  // page is also hidden from the home page, search included. `.hidden-home`
  // entries stay searchable from the home page but are filtered out of its
  // latest/random sections by HomePage itself.
  const galleryTemplates = allTemplates.filter( ( t ) => !t.hiddenFromTemplates );

  const baseUrl = getBaseUrl();

  const breadcrumbItems = [
    {
      name: "Home",
      url: baseUrl
    }
  ];

  return (
    <>
      <BreadcrumbJsonLd items={ breadcrumbItems } />
      <HomePage
        templates={ galleryTemplates }
        engineLabels={ engineLabels }
      />
    </>
  );
}
