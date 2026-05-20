import type {
  Metadata
} from "next";
import {
  Suspense
} from "react";

import {
  getBaseUrl, SITE_NAME
} from "@/lib/seo";
import TemplatesList from "@/components/TemplatesList";
import {
  getTemplatesData
} from "./getTemplatesData";

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Browse all available social media templates. Choose from p5.js sketches, GSAP animations, and HTML templates to create stunning visual content.",
  alternates: {
    canonical: "/templates"
  },
  openGraph: {
    title: `Templates | ${ SITE_NAME }`,
    description:
      "Browse all available social media templates. Choose from p5.js sketches, GSAP animations, and HTML templates.",
    url: `${ getBaseUrl() }/templates`,
    type: "website"
  }
};

export default async function TemplatesPage() {
  const {
    templatesByEngine, engineLabels
  } = await getTemplatesData();

  return (
    <div className="p-3 sm:p-6">
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
