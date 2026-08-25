# Sketches

Read before adding, renaming, editing or deleting a sketch, and before touching the generated catalogue or the sketch routes.

## Where sketches live, and the name that no longer exists

2026-08-20 — Sketches are under `src/sketches/<engine>/` — `p5`, `gsap`, `threejs`, `html` — with p5 sketches at `src/sketches/p5/sketches/<category>/<sketch>/`. Nesting creates categories. Commit 4946ea6 ("Standardize on sketch") moved everything out of `src/templates/` and renamed the routes; `docs/`, older commit messages and even a previous version of `CLAUDE.md` still say `src/templates/` or `src/p5-sketches`, and neither path exists. **How to apply**: trust `tsconfig.json`'s `paths` and `jest.config.js`'s `moduleNameMapper`, which agree — `@/p5/*` → `src/sketches/p5/*`, likewise `@/gsap/*`, `@/threejs/*`, `@/html/*`. If a doc points you at `src/templates/`, the doc is stale.

## Old URLs are kept alive by 308 redirects

2026-08-20 — The same rename moved the gallery and editor from `/templates` to `/sketches`. `next.config.ts` keeps permanent (308) redirects for `/templates` and `/templates/:path*`, because shared links, bookmarks, indexed URLs *and stored recording jobs* still carry the old path — Playwright follows the redirect during backend capture. **How to apply**: do not remove those redirects as dead weight; removing them breaks historical jobs, not just old bookmarks.

## A sketch directory has a fixed shape

2026-08-20 — Each sketch dir holds an entry file (`index.js`, or `.ts`/`.jsx`/`.tsx` — the drift test accepts all four) and an `options.ts` exporting `formValues` (the defaults, a plain nested object) and `formConfiguration` (per-field UI config: `component`, `label`, ranges). Those two exports are what generates the parameter form — there is no separate form code to write. Two marker files control visibility: `.hidden-home` hides a sketch from the home showcase, `.hidden-template` from the `/sketches` gallery (`scripts/watch-sketches.mjs`). **How to apply**: copy the shape from a neighbouring sketch in the same category. Nested groups in `formValues` map to `component: "nested-object"` entries in `formConfiguration`.

## The current p5 sketch API is callback registration

2026-08-20 — p5 sketches import the shared runtime and register lifecycle callbacks; they do not define a bare `function sketch( p, options, assets )`. That older signature survives in `docs/SKETCH_CREATION_GUIDE.md` and is the single most common way to write a sketch that does not run.

```js
import options from "@/p5/utils/options.js";
import sketch, { getP5 } from "@/p5/utils/sketch.js";

sketch.setup( () => { /* one-time setup */ } );
sketch.draw( ( time, center ) => {
  const p = getP5();          // the live p5 instance
  const o = options.sketch;   // this sketch's params, from options.ts
} );
```

**How to apply**: `time` is the duration-scaled loop clock (see `docs/memory/architecture.md` on deterministic capture), never raw seconds. Reach for the existing helpers in `@/p5/utils/` — animation, easing, colors, grid, shapes, mappers, audio, webcam, interaction, slides, title — instead of reinventing them; it is a large toolkit and most sketches are mostly composition.

## Versions are added, not edited

2026-08-20 — Variants live side by side rather than replacing each other: `churros-v1-circle` through `churros-v11-perspective`, `rings-v9-flick-reveal` then `rings-v10-magnetic-flyby`. Old versions stay renderable, which matters because stored presets and jobs reference them by name. **How to apply**: a substantial change to an existing sketch's behaviour is a new `-vN` directory, not an edit in place. Edit in place only for fixes — a broken asset path, a bug — where the previous behaviour was not something anyone would want back.

## The catalogue is generated, hook-synced and drift-tested

2026-08-20 — `scripts/watch-sketches.mjs` scans `src/sketches/` and writes three files: `src/sketches/metadata.json` (the catalogue the gallery and editor read), `src/generated/sketchModuleRegistry.ts` (literal `import()` thunks, so each sketch code-splits) and `src/generated/sketchOptionsRegistry.ts`. Three mechanisms keep them honest: `.husky/pre-commit` regenerates and stages them whenever a file under `src/sketches/` or `public/assets/images/templates/` is in the commit; `src/sketches/__tests__/sketches.test.ts` fails if the committed metadata differs from what the generator would produce today, or if a sketch is missing its entry file, options, thumbnail or preview; and `.gitattributes` resolves their merge conflicts automatically (see `docs/memory/tooling.md`). **How to apply**: never hand-edit the three files. Regenerate with `npm run sketch:meta:write`, or run `npm run watch` during development. Registry thunks must stay literal `import()` calls — a computed specifier would defeat the code splitting the generator exists to produce.

## Cut-paper shapes go through the raw Canvas2D path, and need flat corners

2026-08-24 — The postage-stamp silhouette in `photo/photo-stamp-collage` is built with `p.drawingContext` (`beginPath` / `lineTo` / `arc`), not with p5 shapes, because the same path has to be filled once — so the drop shadow follows the notched outline rather than a rectangle — and then reused as `ctx.clip()` for the photo; a `beginShape()` gives neither. Two traps came out of it. **Corner inset**: distributing the notches over the full edge makes the first notch of two adjacent edges overlap, which eats the corner away and leaves a one-pixel diagonal spike — visible only at 8× zoom, and easy to mistake for an arc-direction bug. Reserve a flat corner (`~1.6 × tooth radius`) at both ends of every edge and distribute the notches over what is left. **Arc direction**: walking the rectangle clockwise on screen, every notch arc is drawn with `anticlockwise = true` (decreasing angle) so its bulge points into the paper; flipping that flag turns bites into bumps. **How to apply**: when a sketch needs cut-paper, torn or die-cut edges, copy that traversal; and verify it by cropping the capture around a corner at high zoom, because the artefact is invisible at full canvas scale.

## Lifting a piece out of a photo: carry the crop as a fraction, not as pixels

2026-08-24 — `photo/photo-stamp-collage` can punch the stamp's shape out of the big photo, so the piece reads as lifted rather than copied (`stamp.cutout`, on by default — it is what the reference collage does). Two rules make it hold up. **One resolved crop, two consumers**: the stamp's source rect is computed once and passed to both the stamp and the hole; recomputing it per consumer is how the two silently drift apart. **Fractions, not pixels**: the crop is carried across as a fraction of its image, so a stamp and a photo of different resolutions still line up, and the hole is then given the stamp's own aspect — which makes it the exact region when both show the same image, and a stamp-shaped window on the same part of the frame when they do not. The hole is repainted with the background *and* the grain layer, clipped to the photo: filling it with the flat background colour alone leaves a suspiciously clean patch in a grainy page. **How to apply**: verify this kind of geometry numerically, not by eye — capture with the effect on and off, take the bounding box of the changed pixels, and compare that crop against what the stamp is holding; a mean channel difference of a few units is resampling, anything more is a mapping bug.

## Decorative noise is painted once, never re-randomised per frame

2026-08-24 — Paper grain, dust and speckles are drawn into a cached `createGraphics` layer from a fixed `p.randomSeed`, keyed on canvas size plus the amount, and blitted each frame (`photo/photo-stamp-collage`). Randomising per frame would both cost a few thousand path fills per draw and break the deterministic-capture rule in `architecture.md` — a recorded video would boil. **How to apply**: use `graphics.createAutoResizableGraphics` and null the cache key from its resize callback, so a canvas resize repaints the layer instead of stretching it.

## Navigation is client-side; module-level p5 state is what breaks

2026-08-23 — Every internal link is `next/link`. A `HardLink` component (a plain `<a rel="noopener noreferrer">`) used to force a full reload from the gallery and the recordings pages, because p5 sketches did not tear down cleanly and a returning visit could end up with two live sketches. That teardown was fixed, so `HardLink` was deleted — and with it the blank internal referrers its `noreferrer` caused (see `docs/analytics.md`). **How to apply**: if a sketch page ever leaves a canvas behind again, fix the teardown; never reintroduce a hard-reload link, which hides the bug and costs the referrer. The trap it was hiding is real and worth knowing: `src/sketches/p5/utils/sketch.js` keeps the instance in module-level `_p5` and sets it to `null` on destroy, so anything asynchronous that outlives the sketch dereferences null. `_refreshAssets` in `utils/options.js` did exactly that through its own 80 ms debounce — leaving a sketch page threw `Cannot read properties of null (reading 'loadImage')`, reproducibly, but only on the *second* gallery round trip. A full reload had always destroyed the module state along with the document, which is why it never showed up before. The guard is an early return when `getP5()` is falsy, placed **before** the cache is touched: a half-filled `imagesMap` would memoise `img: null` entries that the `if ( !obj )` check never retries. Assume any other module-level p5 helper has the same exposure.
