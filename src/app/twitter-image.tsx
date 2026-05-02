// Re-export the OpenGraph image as the Twitter card image
// Note: `runtime` must be a direct literal — Next.js static analysis cannot resolve re-exports
export const runtime = "edge";
export {
  alt, contentType, default, size
} from "./opengraph-image";
