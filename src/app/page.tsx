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
  // page is also hidden from the home page and excluded from the counter,
  // so the "ready to render" stat matches the gallery's real count.
  const galleryTemplates = allTemplates.filter( ( t ) => !t.hiddenFromTemplates );

  // `.hidden-home` additionally narrows the showcase pool — these templates
  // still exist in the gallery but should never appear on the home page.
  const homeTemplates = galleryTemplates.filter( ( t ) => !t.hiddenFromHome );

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
        showcaseTemplates={ homeTemplates }
        engineLabels={ engineLabels }
        totalTemplates={ galleryTemplates.length }
      />
    </>
  );
}
