/**
 * Configuration and send-path for the self-hosted Umami instance.
 *
 * None of these values are secret — they are emitted into the page HTML. The
 * env vars exist so that a fork, a preview deployment or a domain change does
 * not require editing code. They are `NEXT_PUBLIC_*` and therefore baked in at
 * BUILD time (see docs/memory/architecture.md): changing one means rebuilding,
 * not restarting.
 */

/** Tracker URL. Served from a sibling subdomain of the measured site, so it is
 * first-party and no blocker cuts it on a third-party-domain rule. The path is
 * `/insight` rather than Umami's default `/script.js`, which appears in filter
 * lists. */
export const UMAMI_SRC =
  process.env.NEXT_PUBLIC_UMAMI_SRC || "https://insight.steeve.website/insight";

/** Website id created in Umami for p5.steeve.website. An explicitly empty
 * value is a kill switch: no script is emitted and nothing is sent. `??` (not
 * `||`) is what makes that possible — `""` must survive, only an unset var
 * falls back to the default. */
export const UMAMI_WEBSITE_ID =
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "3c44d1c6-1c3e-4ef7-aeb8-646012e9b963";

/** Hostnames allowed to report. Keeps previews, `localhost` and clones of this
 * repo out of the numbers. */
export const UMAMI_DOMAINS =
  process.env.NEXT_PUBLIC_UMAMI_DOMAINS || "p5.steeve.website";

export const isAnalyticsEnabled =
  Boolean( UMAMI_WEBSITE_ID ) &&
  ( process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_UMAMI_DEV === "true" );

type UmamiPayload = {
  url: string;
  referrer: string;
  title: string;
};

type UmamiProps = Record<string, unknown>;

declare global {
  interface Window {
    umami?: {
      track: ( build: ( props: UmamiProps ) => UmamiProps ) => void;
    };
  }
}

/**
 * Pageviews recorded before the tracker script finished loading.
 *
 * `strategy="afterInteractive"` injects the script AFTER hydration, so the
 * tracker component's first effect runs while `window.umami` is still
 * undefined. An optimistic `window.umami?.track(…)` would silently drop the
 * initial pageview of every cold load — the single most important one. Queue
 * instead, and drain in the script's `onLoad`; a `setTimeout` guess would only
 * move the race, not remove it.
 */
const queue: UmamiPayload[] = [];

function send( payload: UmamiPayload ): void {
  window.umami?.track( ( props ) => ( {
    ...props,
    ...payload
  } ) );
}

/** Drains the queue. Wired to the tracker script's `onLoad`. */
export function flushUmamiQueue(): void {
  if ( typeof window === "undefined" || !window.umami ) {
    return;
  }

  while ( queue.length > 0 ) {
    const payload = queue.shift();

    if ( payload ) {
      send( payload );
    }
  }
}

/**
 * Records one pageview, or queues it if the tracker has not loaded yet.
 *
 * `referrer` is the absolute URL of the previous in-app location, or undefined
 * on the first view of a document. Passing it explicitly is what keeps
 * attribution honest: `document.referrer` is frozen at whatever brought the tab
 * here, so without this every internal page would be credited to the original
 * external source.
 */
export function trackPageview(
  url: string, referrer?: string
): void {
  if ( !isAnalyticsEnabled || typeof window === "undefined" ) {
    return;
  }

  const payload: UmamiPayload = {
    url,
    referrer: referrer ?? document.referrer,
    title: document.title
  };

  if ( window.umami ) {
    send( payload );
    return;
  }

  queue.push( payload );
}
