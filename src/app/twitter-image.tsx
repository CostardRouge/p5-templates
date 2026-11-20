// Re-export the OpenGraph image as the Twitter card image
// Note: `runtime` must be a direct literal — Next.js static analysis cannot resolve re-exports
export const runtime = "nodejs";
// Rendered once at build (the static export requires it; the card never changes
// between deploys).
export const dynamic = "force-static";
export {
  alt, contentType, default, size
} from "./opengraph-image";
