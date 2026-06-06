"use client";

import {
  usePathname, useSearchParams
} from "next/navigation";
import {
  useEffect
} from "react";
import {
  pageview
} from "@/lib/analytics/gtag";

/**
 * Tracks client-side navigations in the App Router. The gtag config sets
 * `send_page_view: false`, so this component is responsible for every
 * page_view event — including the initial load.
 */
export default function GoogleAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(
    () => {
      if ( !pathname ) {
        return;
      }

      const query = searchParams?.toString();
      const url = query ? `${ pathname }?${ query }` : pathname;

      pageview( url );
    },
    [
      pathname,
      searchParams
    ]
  );

  return null;
}
