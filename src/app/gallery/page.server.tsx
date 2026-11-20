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

export {
  metadata
} from "./metadata";

/**
 * The full server's gallery (page.static.tsx is the static front's).
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
