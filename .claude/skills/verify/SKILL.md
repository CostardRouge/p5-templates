---
name: verify
description: Verify a sketch or app change end-to-end by driving the running Next.js app headlessly and capturing canvas pixels.
---

# Verifying changes in this repo

## Build & launch

```bash
npm install                 # fresh containers ship without node_modules
npm run build               # compiles every sketch route — catches broken imports
npm start &                 # production server on :3000 (no DB needed for sketch pages)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sketches   # 200 = up
```

Sketch routes: `/sketches/{engine}/{category}/{name}` (e.g.
`/sketches/p5/braid/braid-v1-progressive`). The options form renders on the
same page; `nested-object` groups are collapsed — click the group label to
expand. New sketches need `npm run sketch:meta:write` first.

## Driving headlessly (Playwright)

The project dep is `playwright` (not `@playwright/test`). From a script
outside the repo, import by absolute path:

```js
import { chromium } from "file:///home/user/p5-templates/node_modules/playwright/index.mjs";

const browser = await chromium.launch( {
  executablePath: "/opt/pw-browsers/chromium",
  args: [ "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader" ]
} );
```

## Gotchas

- **`page.screenshot()` times out** — and it is the SwiftShader launch flags,
  not the page: a browser started with `--use-angle=swiftshader` never
  completes a screenshot, even of `setContent( "<h1>hi</h1>" )`, and CDP
  `Page.captureScreenshot` hangs the same way. Removing the canvases first does
  not help. For sketch pixels, capture the canvas directly: `page.evaluate` →
  draw the `<canvas>` into an offscreen 2D canvas → `toDataURL("image/png")` →
  save the base64 payload.
- **To screenshot the UI** (a panel, a control) rather than the sketch: a
  second `chromium.launch()` **without** the GL flags screenshots normally, but
  cannot open a sketch page (no WebGL, the form never mounts). So drive the
  page in the SwiftShader browser, then lift the DOM into the plain one —
  `outerHTML` of the element plus every `document.styleSheets` rule serialized
  through `cssRules` (Turbopack injects the CSS by script, so collecting
  `<link>`/`<style>` tags yields nothing), `setContent` that into a blank page
  and screenshot there. Set each input's `value` **attribute** from its
  property before serializing, or React-controlled fields come out empty.
  Measuring is often enough on its own: `scrollWidth` vs `clientWidth` on an
  input proves text clipping without any picture.
- Software GL is slow (~2 fps on heavy raymarchers). Wait 10–20 s after load
  before the first capture; frames advance, just slowly.
- Form edits are debounced — wait a few seconds after changing an option
  before capturing, or the frame predates the change.
- Simple option probes: visible `input[type='number']` fields (e.g. the
  vector2d x/y) accept `fill()` + `Enter`; selects accept `selectOption()`
  after expanding their group.
- Watch `console` events for `[error]` — GLSL compile failures surface there,
  not in the build.
