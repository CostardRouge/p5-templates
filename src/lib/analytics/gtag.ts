export const GA_MEASUREMENT_ID = "G-CXPSS8NM77";

type GtagCommand = "config" | "event" | "js" | "set";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: ( command: GtagCommand, ...args: unknown[] ) => void;
  }
}

export const isAnalyticsEnabled = process.env.NODE_ENV === "production";

/**
 * Sends a page_view event to GA4 for the given path. Used to track
 * client-side route changes in the App Router, since gtag only fires a
 * pageview automatically on the initial document load.
 */
export function pageview( url: string ): void {
  if ( !isAnalyticsEnabled || typeof window === "undefined" || !window.gtag ) {
    return;
  }

  window.gtag(
    "event",
    "page_view",
    {
      page_path: url,
      page_location: window.location.origin + url
    }
  );
}

type GtagEventParams = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
} & Record<string, unknown>;

/**
 * Sends a custom event to GA4. Categories/labels/values are mapped to the
 * conventional GA4 parameter names.
 */
export function event( {
  action,
  category,
  label,
  value,
  ...rest
}: GtagEventParams ): void {
  if ( !isAnalyticsEnabled || typeof window === "undefined" || !window.gtag ) {
    return;
  }

  window.gtag(
    "event",
    action,
    {
      event_category: category,
      event_label: label,
      value,
      ...rest
    }
  );
}
