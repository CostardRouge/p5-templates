#!/usr/bin/env node

/**
 * Draws the icon set a page of the portfolio ships (COMMON-PROJECT-SPEC C11 in
 * second-brain) from the one source this repository has: the 512 px PNG of the
 * mark, `public/assets/images/icon-512x512.png`. No SVG of the mark exists yet;
 * the day one is drawn, point SOURCE at it and the rest of this file stands.
 *
 *   node scripts/gen-icons.mjs
 *
 * Writes — and the PNGs are committed, a static host cannot rasterise on
 * request:
 *
 * - `public/favicon-16.png`, `public/favicon-32.png`: the raster favicons the
 *   browsers that still prefer one to the .ico read, transparent like the mark;
 * - `public/apple-touch-icon.png`: 180 × 180 and OPAQUE. iOS builds the
 *   home-screen icon from this file alone and paints transparency black under
 *   its own rounded mask, so the mark is flattened on the manifest's
 *   background colour and the file carries no alpha channel at all.
 *
 * The 192 / 512 `any` and maskable icons the manifest lists were drawn by hand
 * and are left as they are. `sharp` is a dependency of the app (the debug
 * icons page reads files with it), so there is nothing to install;
 * `src/app/__tests__/icons.test.ts` checks the sizes and the alpha of what is
 * committed.
 */

import path from "path";
import {
  fileURLToPath
} from "url";
import sharp from "sharp";
import {
  THEME_COLOR_LIGHT
} from "../src/config/site.ts";

const publicDir = path.join(
  path.dirname( fileURLToPath( import.meta.url ) ),
  "..",
  "public"
);

const SOURCE = path.join(
  publicDir,
  "assets",
  "images",
  "icon-512x512.png"
);

const FAVICONS = [
  {
    file: "favicon-16.png",
    size: 16
  },
  {
    file: "favicon-32.png",
    size: 32
  }
];

for ( const {
  file, size
} of FAVICONS ) {
  await sharp( SOURCE )
    .resize(
      size,
      size
    )
    .png()
    .toFile( path.join(
      publicDir,
      file
    ) );

  console.log( `✓ ${ file } (${ size } × ${ size }, transparent)` );
}

// `flatten` composites the mark on the colour; `removeAlpha` then drops the
// channel so the file itself says RGB — `file` and sharp's `hasAlpha` agree.
await sharp( SOURCE )
  .resize(
    180,
    180
  )
  .flatten( {
    background: THEME_COLOR_LIGHT
  } )
  .removeAlpha()
  .png()
  .toFile( path.join(
    publicDir,
    "apple-touch-icon.png"
  ) );

console.log( `✓ apple-touch-icon.png (180 × 180, opaque on ${ THEME_COLOR_LIGHT })` );
