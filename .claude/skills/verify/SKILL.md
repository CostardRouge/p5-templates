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

- **`page.screenshot()` times out** on WebGL sketch pages — the compositor
  never goes idle under SwiftShader. Capture the canvas directly instead:
  `page.evaluate` → draw the `<canvas>` into an offscreen 2D canvas →
  `toDataURL("image/png")` → save the base64 payload.
- Software GL is slow (~2 fps on heavy raymarchers). Wait 10–20 s after load
  before the first capture; frames advance, just slowly.
- Form edits are debounced — wait a few seconds after changing an option
  before capturing, or the frame predates the change.
- Simple option probes: visible `input[type='number']` fields (e.g. the
  vector2d x/y) accept `fill()` + `Enter`; selects accept `selectOption()`
  after expanding their group.
- Watch `console` events for `[error]` — GLSL compile failures surface there,
  not in the build.
