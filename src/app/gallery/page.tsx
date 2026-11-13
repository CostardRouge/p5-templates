import type {
  Metadata
} from "next";
import {
  cookies
} from "next/headers";
import GalleryPage from "@/components/GalleryPage/GalleryPage";
import {
  GALLERY_COOKIE, readGalleryPrefs
} from "@/lib/gallery/view";
import {
  localDay
} from "@/lib/postiz/rhythm";

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

/**
 * Rendered per request, on purpose (lab 3): the view he chose last (Month ·
 * Week · Grid) and his time zone travel in a cookie, so the server paints the
 * page in its FINAL view and with today marked — a `localStorage` read would
 * paint Month first and swap after hydration, the reflow he ruled out.
 */
export default async function Page() {
  const prefs = readGalleryPrefs( ( await cookies() ).get( GALLERY_COOKIE )?.value );

  return (
    <GalleryPage
      initialView={ prefs.view }
      initialTimeZone={ prefs.timeZone }
      initialToday={ localDay(
        new Date(),
        prefs.timeZone
      ) }
    />
  );
}
