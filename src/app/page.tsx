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
        templates={ allTemplates }
        engineLabels={ engineLabels }
        totalTemplates={ allTemplates.length }
      />
    </>
  );
}
