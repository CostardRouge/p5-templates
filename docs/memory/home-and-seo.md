# Home page, marketing surface and SEO

Read before touching `src/app/page.tsx`, `src/components/HomePage.tsx`, `src/components/StudioFeatures/`, `src/config/site.ts`, `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/sitemap/page.tsx` or the capture assets under `public/assets/images/features/`.

## Two site maps, one machine-readable and one for people (2026-09-04)

`app/sitemap.ts` (the metadata file) owns `/sitemap.xml`; `app/sitemap/page.tsx` owns `/sitemap`. Next resolves the two independently — both show up as separate static routes in the build output — so the folder does **not** need a different name to avoid a collision.

- The page is a **server component**: every sketch is an anchor in the first HTML response, which is the point — one crawlable page reaching all ~300 sketch routes, and the only place the shape of the site is visible without working the gallery's filters.
- Sketch links are `prefetch={ false }`. A `next/link` prefetches once it scrolls into the viewport; three hundred of them would pull a sketch route's payload for every link the reader scrolls past. The dozen navigation links above them keep the default.
- **Three columns, never four.** At four, a name like "Animated Text Points V10 Asterisk" no longer fits, and a truncated entry defeats a list whose whole job is telling near-identical `-vN` variants apart. Long names wrap.
- **The heading needs `pt-14` on a phone.** `MenuBar` is `fixed top-2 left-2` (`md:top-4 md:left-4`), so at the usual `p-3 sm:p-6` page padding the button sits on top of the `h1`. Any new full-width page with a heading in the top-left corner has the same problem.
- The page lists sketches under the gallery's rule (`filterSketchesForGallery`) — production drops the `.hidden-template` ones — while `sitemap.ts` maps raw `getMetadata()` and does not. So the XML advertises three sketches the HTML page hides. Close that when next touching `sitemap.ts`; `/recordings` is in the XML too while its page is `robots: index:false`.
- Audited with axe-core in both colour schemes (same setup as the studio tour below): zero violations. Keep it that way.

## The home page documents the editor, and does it with real screenshots (2026-08-31)

The `/capabilities` grid used to be the only description of what the studio can do: six cards, no pictures. It now heads a **studio tour** — `StudioFeatures`, one section per surface of the sketch page (controls, modulation, mixer, elements, layers, slides, transitions, export, transport, presentation, document, sound), each with a screenshot of that surface. The six cards survive as the tour's table of contents: five of them link to a section anchor, the sixth (Open source) has no `href`.

Rules that are load-bearing:

- **`StudioFeatures` is a server component handed to `HomePage` as the `studioFeatures` prop, never imported by it.** `HomePage` is `"use client"`; importing the tour there would ship a dozen sections of static prose into the browser bundle for no reason. `page.tsx` renders `<StudioFeatures />` into the slot. Same trick applies to anything else static that has to sit *inside* the client page's layout.
- **The copy lives in `features.ts` as data, not in JSX.** One list feeds the rendered sections, the in-page jump navigation and the `ItemList` JSON-LD; splitting them is how two of the three go stale.
- **Every picture is a real capture of the running studio.** No mockups, no hand-drawn diagrams — the maintainer's standard for verification (`MEMORY.md`, "Working with Steeve Pommier") applies to marketing material too. How to retake them is below.
- **Captures are 2× assets rendered at half size** (`style={{ width: capture.width / 2 }}`) with `max-h-[70svh] w-auto`: crisp on dense displays, and a 944px-tall inspector panel does not become a screenful of scrolling on a phone. `width`/`height` are always on the `<img>` so the aspect ratio is reserved before the file arrives.
- **`APP_FEATURE_LIST` (site config → WebApplication JSON-LD) is kept in step with the tour.** If a feature earns a section, it earns a line there. It listed "EXIF data overlay" for months, which no longer exists anywhere in the UI.
- The home page carries its own `HOME_DESCRIPTION`, distinct from `SITE_DESCRIPTION`: it is now a feature page, not a generic landing page.
- **`/` was missing from `sitemap.ts`** — only `/sketches`, `/recordings` and every sketch route were listed. It is there now at priority 1.0; do not drop it again.

## Accessibility (2026-08-31)

The tour is audited with `axe-core` (already a transitive dependency) driven from Playwright, in **both colour schemes**, after scrolling `main` to the bottom so every lazy image has loaded — `document.body` does not scroll on this app (`main` is the `overflow-auto` element), so a plain `fullPage` screenshot or an unscrolled audit sees only the first viewport. The tour itself reports zero violations; keep it that way when adding a section.

- **A sketch card's picture is decorative** — the card prints the sketch's name in the same link, so alt text repeating it makes a screen reader say it twice (`image-redundant-alt`). `AnimatedPreview` takes an optional `alt` for this; the home page's cards pass `""`.
- Open: `SketchesList` (the `/sketches` gallery, grid **and** list view) still repeats the name in its `AnimatedPreview` / `Thumbnail` alt text and trips the same rule. Same one-line fix, left out of the home-page change to keep the commit to one task.
- Captures are `<img>` with intrinsic `width`/`height`, `loading="lazy"`, `decoding="async"`, a real `alt` describing the panel's content (not "screenshot of…") and a visible `<figcaption>`.

## Retaking the capture assets (2026-08-31)

The screenshots in `public/assets/images/features/` were taken headlessly against a **production build with the plugin flags the published image uses** (`INTERACTION_BINDINGS=true LIVE_THUMBNAIL=true npm run build`, then `npm start`). That matters: `interactionBindingsEnabled()` is off by default, so a default build shows **no modulation affordance at all** and the `binding` / `mixer` captures cannot be taken. `.github/workflows/docker-build.yml` is the reference for which flags the deployed site really has.

Traps hit while producing them, all still true:

- **`page.screenshot()` hangs on a running sketch** (the SwiftShader compositor never idles) — click `button[aria-label='Pause playback']` first and every screenshot resolves, clipped or full-page. This is a better fix than the "capture the canvas via `toDataURL`" workaround in `.claude/skills/verify/`, which cannot photograph the UI around the canvas.
- **Pick a non-WEBGL sketch for anything showing the canvas.** `noise-lines/noise-lines-circle-colored` is the one used: 2D, colourful, fast, and its parameters randomize into visibly different slides (which is what makes the filmstrip capture read).
- **Docked vs floating changes what can be captured.** `localStorage["sketchbook:docked-workspace"] = "true"` via `addInitScript` gives the docked studio (one full-window shot, wider 320px rails); the default floating layout gives self-contained rounded cards, which is what the inspector, mixer and sound captures use.
- **Panel group headers are `div`s with `onClick`, not buttons** (`CollapsibleItem`), so Playwright's `getByRole` finds nothing — click the label text. Parameter groups start collapsed, and the modulation buttons only exist inside an expanded group, so expand one before looking for `button[title='Modulate this parameter']`.
- **The transition band is expanded by default but shows only its master switch** until "Montage / transition" is on. Clicking the band header collapses it; click the switch at the right edge of that row instead.
- The zoom cluster's presentation menu opens on **hover** of `button[aria-label='Fit to viewport']`, not on click.
- Deliberately not captured: the **share/embed dialog**, because it prints `http://localhost:3000/…` into the link and iframe fields and there is no production hostname in the repo to substitute. If a canonical domain is ever set, that capture becomes worth adding.

Conversion is `sharp` (already a dependency) → WebP quality 84; the whole set is ~330 KB.
