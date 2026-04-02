import type { Metadata } from "next";
import { getBaseUrl, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Photo EXIF - GSAP Template",
  description:
    "Create animated photo presentations with EXIF metadata overlays using GSAP timeline animations. Perfect for photography social media content.",
  keywords: [
    "GSAP animation",
    "photo EXIF",
    "animated photo",
    "photography video",
    "social media video",
    "camera metadata",
  ],
  alternates: {
    canonical: "/templates/gsap/photo-exif",
  },
  openGraph: {
    title: `Photo EXIF - GSAP Template | ${SITE_NAME}`,
    description:
      "Create animated photo presentations with EXIF metadata overlays using GSAP timeline animations.",
    url: `${getBaseUrl()}/templates/gsap/photo-exif`,
    type: "website",
  },
};

export default function PhotoExifLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
