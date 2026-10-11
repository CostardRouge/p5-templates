import type {
  Metadata
} from "next";
import GalleryPage from "@/components/GalleryPage/GalleryPage";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "The pieces you kept in this browser: every exported or saved piece with its options and a thumbnail, ready to reopen in the studio.",
  alternates: {
    canonical: "/gallery"
  },
  // Personal, per-browser content: nothing for a crawler to index.
  robots: {
    index: false,
    follow: true
  }
};

export default GalleryPage;
