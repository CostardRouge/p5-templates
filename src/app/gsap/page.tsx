import type {
  Metadata
} from "next";
import GSAPTemplateBrowser from "@/components/GSAPTemplateBrowser/GSAPTemplateBrowser";
import {
  getBaseUrl, SITE_NAME
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "GSAP Templates",
  description:
    "Browse GSAP animation templates for creating smooth, professional social media videos with timeline-based animations.",
  keywords: [
    "GSAP",
    "animation templates",
    "timeline animation",
    "motion graphics",
    "social media video",
  ],
  alternates: {
    canonical: "/gsap",
  },
  openGraph: {
    title: `GSAP Templates | ${ SITE_NAME }`,
    description:
      "Browse GSAP animation templates for creating smooth, professional social media videos.",
    url: `${ getBaseUrl() }/gsap`,
    type: "website",
  },
};

export default function GSAPTemplatesPage() {
  return <GSAPTemplateBrowser />;
}
