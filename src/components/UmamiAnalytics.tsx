"use client";

import Script from "next/script";
import {
  flushUmamiQueue,
  isAnalyticsEnabled,
  UMAMI_DOMAINS,
  UMAMI_SRC,
  UMAMI_WEBSITE_ID
} from "@/lib/analytics/umami";

/**
 * Loads the Umami tracker. A client component because it needs `onLoad` to
 * drain the pageview queue (see `@/lib/analytics/umami`).
 *
 * `data-auto-track="false"` is deliberate and load-bearing. Next navigates
 * without reloading the document, so Umami's auto-tracking would record one
 * pageview per tab — or record later ones carrying the previous page's title.
 * `UmamiTracker` sends every view by hand instead.
 */
export default function UmamiAnalytics() {
  if ( !isAnalyticsEnabled ) {
    return null;
  }

  return (
    <Script
      src={ UMAMI_SRC }
      data-website-id={ UMAMI_WEBSITE_ID }
      data-domains={ UMAMI_DOMAINS }
      data-auto-track="false"
      data-do-not-track="true"
      strategy="afterInteractive"
      onLoad={ flushUmamiQueue }
    />
  );
}
