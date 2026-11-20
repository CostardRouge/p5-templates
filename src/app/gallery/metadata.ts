import type {
  Metadata
} from "next";

/* Shared by page.server.tsx and page.static.tsx (next.config.ts, "Two builds"). */
export const metadata: Metadata = {
  title: "Gallery",
  description:
    "The pieces you kept in this browser and what each became on the networks — by month, by week or as a grid — ready to reopen in the studio.",
  alternates: {
    canonical: "/gallery"
  },
  // Personal, per-browser content: nothing for a crawler to index.
  robots: {
    index: false,
    follow: true
  }
};
