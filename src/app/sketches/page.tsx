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
import SketchesList from "@/components/SketchesList";
import {
  filterSketchesForGallery,
  getSketchesData
} from "./getSketchesData";

const TITLE = "Sketches";
const DESCRIPTION =
  "Browse all available creative-coding sketches. Choose from p5.js, GSAP, and Three.js sketches to create stunning visual content.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/sketches"
  },
  openGraph: {
    title: buildOgTitle( TITLE ),
    description: DESCRIPTION,
    url: "/sketches",
    siteName: SITE_NAME,
    type: "website"
  }
};

export default async function SketchesPage() {
  const {
    sketchesByEngine, engineLabels
  } = await getSketchesData();
  const baseUrl = getBaseUrl();

  // In production we hide sketches marked `.hidden-template` entirely.
  // In development they stay visible but are rendered grayed-out + still
  // clickable (the flag is forwarded so the UI can style them).
  const filteredByEngine = filterSketchesForGallery( sketchesByEngine );

  const breadcrumbItems = [
    {
      name: "Home",
      url: baseUrl
    },
    {
      name: "Sketches",
      url: `${ baseUrl }/sketches`
    }
  ];

  return (
    <div className="p-3 sm:p-6">
      <BreadcrumbJsonLd items={ breadcrumbItems } />
      <Suspense>
        <SketchesList
          sketches={ filteredByEngine }
          engineLabels={ engineLabels }
          activeEngine="all"
        />
      </Suspense>
    </div>
  );
}
