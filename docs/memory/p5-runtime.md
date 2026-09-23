# p5 runtime — the 2.x upgrade, its compat layer, and the traps it left

Read before touching `src/sketches/p5/utils/sketch.js` (`loadP5Class`), `assetLoaders.js`, text geometry (`string.js`, anything calling `textToPoints`/`textBounds`), curves, or before adding a font.

## The compat layer lives in one place, on purpose

2026-09-23 — p5 is 2.x (`^2.3.0`, was 1.x). Sketches were not rewritten for it: `loadP5Class()` patches the class once at load so 1.x idioms keep working. **Graphics backfill**: 2.x `p5.Graphics` delegates only a subset of `p5.prototype` (no `createVector`, `constrain`, `dist`, no constants like `LEFT`/`WORD`); every missing member is copied onto `Graphics.prototype`. The sketch-layer proxy (`nestedSketch.js`, see `architecture.md`) depends on this — its "a Graphics carries every `p5.prototype` method" premise is only true because of the backfill. **`Color.levels`** (0–255 RGBA, removed in 2.x, destructured by ~20 sketches) is a getter over `_array`, memoised per instance. **`p5.disableFriendlyErrors = true`**: 2.x zod-validates the arguments of *every* prototype call; that dominated draw-loop profiles (a 2D sketch ran at ~half its 1.x frame rate). **How to apply**: fix a 2.x incompatibility in `loadP5Class` if it is generic, in the sketch if it is not; never re-enable friendly errors globally.

## Loaders are promises; the wrappers hand out placeholders

2026-09-23 — `loadImage`/`loadFont` return promises in 2.x, and **passing success/failure callbacks changes the promise**: it resolves with the callback's return value, and a failure resolves instead of rejecting — a missing asset reads as loaded. `assetLoaders.js` therefore awaits the bare promise and keeps the 1.x contract (`{ img|font, ready }`, object usable immediately): it constructs a placeholder of the right class (1×1 `p5.Image`, or a `p5.Font` whose `face.family` is `sans-serif` so `textFont()` accepts it) and grafts the loaded object onto it — re-pointing self-references (`Image._pixelsState = this`) and calling `setModified( true )` so a bound WebGL texture re-uploads. There is no `preload()`: the engine awaits the `engine-window-preload` handlers inside setup, and `_refreshAssets` publishes the image cache immediately, then resolves once every image has decoded or failed. **How to apply**: new asset kinds follow the same shape; never call `getP5().loadX( url, cb, errCb )` expecting a p5.X back.

## Text: readiness is `font.data`, size comes from the renderer

2026-09-23 — A font is ready for glyph geometry when `font.data` is set (1.x: the opentype `font.font`); its family for cache keys is `font.name || font.face?.family`. `Font.textToPoints/textBounds/textToContours` take **no size**: a 4th positional number is a wrap *width*, so a 1.x call `( str, x, y, size, opts )` silently returns wrapped, wrong-sized geometry. Set `textFont`/`textSize` on the renderer and pass `{ graphics: p }` in the options, or use `string.textToPoints` / `string.textBounds`, which keep the 1.x signature. `p.textFont( null )` throws in 2.x (1.x ignored it).

## Curves: 1.x names are gone

2026-09-23 — `curveVertex`/`curveTightness`/`quadraticVertex`/`curve*` do not exist in 2.x (a call is a TypeError). `splineVertex` + `splineProperty( "tightness", t )` replace the first two; **`splineProperty( "ends", p.EXCLUDE )` is required for 1.x semantics** (first/last vertices are control points only — the 2.x default `INCLUDE` passes through them). `quadraticVertex( cx, cy, x, y )` → `bezierOrder( 2 )` then `bezierVertex( cx, cy ); bezierVertex( x, y )`. Both properties are renderer state: save and restore them. `splines/_shared.js` was ported this way and measured against 1.x with `bench-sketch.mjs`: 2 pixels over 40 levels apart per frame (edge shading only), versus 305k when the geometry really changes. `TESS` is gone too (default `beginShape()` tessellates).

## Font files: Typr is stricter than opentype.js

2026-09-23 — 2.x parses fonts with a bundled Typr, which crashes on some files that 1.x read fine; the font then falls back to a CSS-only FontFace with **no `font.data`**, and every glyph-geometry sketch on it renders blank with only a console warning ("No glyph data … retrying as FontFace"). Two classes hit this repo, both fixed in the asset: **variable fonts** (`martian`, `cloitre`, `onlysans-variable`, `waverse-variable` — instanced at their default axes with fonttools; nothing animates axes) and an **`SVG ` colour table** (`multicoloure` — Typr calls a `Typr.U.SVG` module p5 does not ship; the table was dropped after measuring that Chromium already draws the font as plain outlines in canvas text). **How to apply**: after adding a font, check `(await p.loadFont( path )).data` is set in a real browser before shipping it.

## Deliberately not changed

- `animated-text-points-v1-grid` cannot be read by `bench-sketch.mjs` (its canvas returns no 2D context there) on 1.x and 2.x alike; check it through the studio page instead.
- Seeded `random()` and seeded `noise()` are identical in 1.x and 2.x; *unseeded* `noise()` differs on every page load in both — see the open item in `MEMORY.md`.
