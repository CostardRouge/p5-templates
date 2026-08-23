"use client";

import {
  usePathname, useSearchParams
} from "next/navigation";
import {
  useEffect, useRef
} from "react";
import {
  trackPageview
} from "@/lib/analytics/umami";

/**
 * Sends one pageview per navigation, including the initial one.
 *
 * The tracker script runs with auto-tracking off (see `UmamiAnalytics`), so
 * this component is the only source of pageviews. `usePathname` +
 * `useSearchParams` are the App Router's source of truth for "where are we
 * now"; because `useSearchParams` suspends, callers must wrap this in
 * `<Suspense>`.
 *
 * Two guards matter:
 *
 * - Identical consecutive URLs are dropped. This absorbs React StrictMode's
 *   double mount in development and any re-render that re-runs the effect
 *   without the location actually changing.
 * - The previous in-app URL is kept in a ref and passed as the referrer, so
 *   internal navigations chain (`/` -> `/sketches` -> …) instead of every page
 *   being credited to whatever external source opened the tab.
 */
export default function UmamiTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrl = useRef<string | null>( null );

  useEffect(
    () => {
      if ( !pathname ) {
        return;
      }

      const query = searchParams?.toString();
      const url = query ? `${ pathname }?${ query }` : pathname;

      if ( previousUrl.current === url ) {
        return;
      }

      // Absolute, because that is what a real document load would have put in
      // `document.referrer`.
      const referrer = previousUrl.current
        ? `${ window.location.origin }${ previousUrl.current }`
        : undefined;

      trackPageview(
        url,
        referrer
      );
      previousUrl.current = url;
    },
    [
      pathname,
      searchParams
    ]
  );

  return null;
}
