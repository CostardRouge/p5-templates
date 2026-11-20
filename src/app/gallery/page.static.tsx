import GalleryFromCookie from "@/components/GalleryPage/GalleryFromCookie";

export {
  metadata
} from "./metadata";

/* The static front's gallery: no server to read the view cookie, so the
   browser reads it before the gallery mounts (GalleryFromCookie) — the page
   still opens in the view chosen last, never Month first and swapped. */
export default function Page() {
  return <GalleryFromCookie />;
}
