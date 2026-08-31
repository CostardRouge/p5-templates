import type {
  Metadata
} from "next";
import HomePage from "@/components/HomePage";
import StudioFeatures from "@/components/StudioFeatures";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd/BreadcrumbJsonLd";
import {
  buildOgTitle, getBaseUrl, HOME_DESCRIPTION, SITE_NAME
} from "@/lib/seo";
import {
  getSketchesData
} from "./sketches/getSketchesData";

export const metadata: Metadata = {
  title: SITE_NAME,
  // The home page now documents the editor in detail, so it gets a
  // description of its own rather than the site-wide one.
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: buildOgTitle( "Home" ),
    description: HOME_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website"
  }
};

export default async function Home() {
  const {
    sketchesByEngine, engineLabels
  } = await getSketchesData();

  const allSketches = Object.values( sketchesByEngine ).flat();

  // `.hidden-template` is the public gate — anything hidden from the gallery
  // page is also hidden from the home page, search included. `.hidden-home`
  // entries stay searchable from the home page but are filtered out of its
  // latest/random sections by HomePage itself.
  const gallerySketches = allSketches.filter( ( t ) => !t.hiddenFromGallery );

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
        sketches={ gallerySketches }
        engineLabels={ engineLabels }
        studioFeatures={ <StudioFeatures /> }
      />
    </>
  );
}
