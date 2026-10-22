import {
  STUDIO_FEATURES
} from "@/components/StudioFeatures/features";
import {
  listIndexableSketches
} from "@/engines/metadata";
import {
  buildLlmsTxt
} from "@/lib/llmsTxt";
import {
  getBaseUrl
} from "@/lib/seo";

// Rendered once at build time, like `sitemap.ts`: everything it reads is in
// the repo, and a route handler is dynamic by default since Next 15. Its
// absolute URLs therefore follow the build-time origin (`getBaseUrl()`, see
// docs/memory/home-and-seo.md).
export const dynamic = "force-static";

/** `/llms.txt` — the site described for a language model (`lib/llmsTxt.ts`). */
export function GET(): Response {
  const body = buildLlmsTxt( {
    baseUrl: getBaseUrl(),
    sketches: listIndexableSketches(),
    features: STUDIO_FEATURES
  } );

  return new Response(
    body,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}
