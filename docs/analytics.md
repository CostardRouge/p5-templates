# Analytics

p5.steeve.website is measured with a **self-hosted Umami** instance. No cookies,
no consent banner, no third-party network calls.

Unlike the rest of `docs/`, this file is maintained — keep it true.

## Configuration

Everything lives in `src/lib/analytics/umami.ts`. Nothing here is secret; it all
ends up in the page HTML. The env vars exist so a fork, a preview or a domain
change never needs a code edit.

| Constant | Env override | Default |
| --- | --- | --- |
| `UMAMI_SRC` | `NEXT_PUBLIC_UMAMI_SRC` | `https://insight.steeve.website/insight` |
| `UMAMI_WEBSITE_ID` | `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | `3c44d1c6-1c3e-4ef7-aeb8-646012e9b963` |
| `UMAMI_DOMAINS` | `NEXT_PUBLIC_UMAMI_DOMAINS` | `p5.steeve.website` |
| — | `NEXT_PUBLIC_UMAMI_DEV` | unset (`"true"` enables tracking outside production) |

`isAnalyticsEnabled` is `Boolean( UMAMI_WEBSITE_ID ) && ( production || NEXT_PUBLIC_UMAMI_DEV === "true" )`.

**An empty website id is the kill switch.** It emits no script, no connection
hints and sends nothing. That is why the module uses `??` rather than `||` for
the id: `""` must survive as a real value, only an *unset* var falls back to the
default.

These are `NEXT_PUBLIC_*`, so they are **baked in at build time** (see
`docs/memory/architecture.md`). Changing one means rebuilding — restarting the
server is not enough. The `Dockerfile` therefore declares them as `ARG`s, and
unlike the other `NEXT_PUBLIC_*` args they are **not** empty-defaulted: an empty
default would silently ship every image with analytics off.

## Why the tracker is served from `insight.steeve.website/insight`

- Same registrable domain as the measured site, so the request is first-party
  and no blocker cuts it on a third-party-domain rule.
- The path is `/insight`, not Umami's default `/script.js`, which appears in
  filter lists.
- `insight.steevepommier.com/insight` is the same instance and works (CORS is
  permissive), but it makes the request third-party again. Use it only as a
  fallback, via `NEXT_PUBLIC_UMAMI_SRC`.

## Why auto-tracking is off

`data-auto-track="false"` is load-bearing, not a preference.

Next navigates without reloading the document. Left on auto-track, Umami records
one pageview per *tab* — or records later views carrying the *previous* page's
title. So `UmamiTracker` sends every view by hand:

- **One view per navigation**, driven by `usePathname()` + `useSearchParams()`,
  plus the initial one. Because `useSearchParams` suspends, the component must
  be wrapped in `<Suspense>` (it is, in `src/app/layout.tsx`).
- **Consecutive identical URLs are dropped**, which absorbs React StrictMode's
  double mount and any effect that re-runs without the location changing.
- **The referrer is chained.** `document.referrer` is frozen at whatever brought
  the tab here, so without this every internal page would be credited to the
  original external source. The previous in-app URL is kept in a ref and sent as
  the referrer instead.

`data-domains` keeps previews, `localhost` and repo clones out of the numbers.
`data-do-not-track="true"` honours the browser setting.

## The load race, and why there is a queue

`strategy="afterInteractive"` injects the tracker **after** hydration, so the
tracker component's first effect runs while `window.umami` is still undefined.
An optimistic `window.umami?.track(…)` silently drops the initial pageview of
every cold load — the single most important one.

`trackPageview` therefore queues when `window.umami` is absent, and the
`<Script onLoad>` handler drains the queue. A `setTimeout` would only move the
race, not remove it.

## Internal referrers, and the `HardLink` that used to break them

Gallery cards and the recordings pages used to navigate through a `HardLink`
component — a plain `<a rel="noopener noreferrer">` that forced a full reload.
`noreferrer` meant the browser sent no `Referer`, so a sketch opened from the
gallery was recorded with a **blank referrer** instead of `/sketches`.

`HardLink` existed to work around p5 sketches not tearing down cleanly (a
returning visit could end up with two live sketches). That teardown was fixed
independently, so the component was removed and every call site now uses
`next/link`. Internal referrers chain correctly through the gallery as a result.

If a sketch page ever again leaves a canvas behind, fix the teardown — do not
reintroduce a hard-reload link. See `docs/memory/sketches.md`.

## Opt-out

Umami reads `localStorage["umami.disabled"]` on every send, so setting it is all
that is required — there is nothing to implement on the send path:

```js
localStorage.setItem( "umami.disabled", "1" ); // stop being counted
localStorage.removeItem( "umami.disabled" );   // resume
```

There is no site-wide settings panel today (the settings UI is per-sketch sketch
options), so no toggle is wired up. If one is ever added, put the switch there —
and if a "reset preferences" action is ever added, **exclude this key**:
resetting the appearance must not turn someone back into a counted visitor.

## Service worker

The app ships `public/sw.js`, which can serve a cached document to a returning
visitor. After a deploy that changes the tracker, such a visitor may run the old
HTML until the cache expires. If the first day's numbers look unexpectedly low,
check that before suspecting the tracker.

## Verification protocol

A tracker that stops counting does not raise an alarm, so verify it — do not
read the code and conclude.

### Offline, against the real production build

`npm run build` and serve it, then drive headless Chromium. Point
`NEXT_PUBLIC_UMAMI_SRC` at a local stand-in that defines `window.umami` but does
not exist until it executes — that is what exercises the queue. Installing a
fake `window.umami` *before* page scripts would hide the very race the queue
exists for.

Then: cold load → internal link → back → forward. Expect

- exactly **one view per navigation**, never zero, never two;
- the **URLs** in order;
- **chained referrers** (`/` → `/sketches` → …), not the external source repeated;
- the document **never reloaded** — set a marker on `window` after the first
  load and check it survives.

Add a second scenario that clicks through the gallery into a sketch and back
again: it is the path most likely to regress, since it is the one that used to
force a full reload. Assert the referrer chain **and** that each sketch page ends
with exactly one `<canvas>` in the DOM.

### Online, once deployed

Umami never stores a raw IP (it is hashed into the session id), so check it
indirectly: browse the site **through a VPN in another country** and confirm a
second country appears under Countries with two distinct visitors. Symptoms of a
broken chain: an empty or `Unknown` country (a private IP is arriving), one
country for everybody, or pageviews climbing while the visitor count stays at 1.

`CLIENT_IP_HEADER=cf-connecting-ip` is the setting that makes this correct on the
cloudflared → Traefik chain in front of Umami. It is already verified on the
shared instance; nothing to change per-site.
