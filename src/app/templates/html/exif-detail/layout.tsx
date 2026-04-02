import type { Metadata } from "next";
import { getBaseUrl, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "EXIF Detail Template",
  description:
    "Upload a photo and overlay its EXIF metadata (camera, lens, ISO, aperture, shutter speed) in a beautiful social media-ready format.",
  keywords: [
    "EXIF data",
    "photo metadata",
    "camera settings overlay",
    "photography template",
    "Instagram photo",
    "social media photography",
  ],
  alternates: {
    canonical: "/templates/html/exif-detail",
  },
  openGraph: {
    title: `EXIF Detail Template | ${SITE_NAME}`,
    description:
      "Upload a photo and overlay its EXIF metadata in a beautiful social media-ready format.",
    url: `${getBaseUrl()}/templates/html/exif-detail`,
    type: "website",
    images: [
      {
        url: "/assets/images/templates/html/exif-detail/thumbnail.jpg",
        width: 1200,
        height: 630,
        alt: "EXIF Detail Template preview",
      },
    ],
  },
};

export default function ExifDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
