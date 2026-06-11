#!/usr/bin/env node

/**
 * Generate the default example videos shipped with the video templates.
 *
 * Mirrors the role of `public/assets/images/test` for photo sketches: small,
 * self-contained clips users see in the sketch settings form before they
 * upload anything. Three clips are produced in `public/assets/videos/test`:
 *
 *  - `gradient-flow.mp4`  — seamlessly looping animated color gradient.
 *  - `photos-zoom.mp4`    — Ken Burns slideshow built from the default test
 *                           photos (slow zoom + crossfades).
 *  - `shapes-orbit.mp4`   — orbiting white circles on black; high contrast,
 *                           useful for halftone / text-mask templates.
 *
 * Requires `ffmpeg` on the PATH (already installed in the runtime Docker
 * image). Re-run after changing the recipes: the outputs are committed so
 * the app never generates them at runtime.
 *
 * Usage: node scripts/generate-test-videos.mjs
 */

import {
  execFileSync
} from "child_process";
import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";

const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

const projectRoot = path.join(
  __dirname,
  ".."
);
const testImagesDir = path.join(
  projectRoot,
  "public/assets/images/test"
);
const outputDir = path.join(
  projectRoot,
  "public/assets/videos/test"
);

// Shared output settings: square 720p, 30 fps, H.264 in a fast-start MP4 so
// playback begins before the file is fully fetched. CRF 28 keeps each clip
// well under 1 MB.
const SIZE = 720;
const FPS = 30;
const encodeArgs = [
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "28",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-an"
];

function ffmpeg( args ) {
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      ...args
    ],
    {
      stdio: "inherit"
    }
  );
}

/**
 * Seamlessly looping animated gradient. Every time term is a multiple of
 * `2*PI*T/duration`, so the last frame flows back into the first.
 */
function generateGradientFlow( outputPath ) {
  const duration = 6;
  const geq = [
    `r='128+127*sin(2*PI*(X/${ SIZE }+Y/${ SIZE })+2*PI*T/${ duration })'`,
    `g='128+127*sin(2*PI*(X/${ SIZE }-Y/${ SIZE })+2*PI*T/${ duration }+2)'`,
    `b='128+127*sin(2*PI*hypot(X-${ SIZE / 2 },Y-${ SIZE / 2 })/${ SIZE / 2 }+4*PI*T/${ duration })'`
  ].join( ":" );

  ffmpeg( [
    "-f",
    "lavfi",
    "-i",
    `nullsrc=s=${ SIZE }x${ SIZE }:d=${ duration }:r=${ FPS }`,
    "-vf",
    `geq=${ geq }`,
    ...encodeArgs,
    outputPath
  ] );
}

/**
 * Two white circles orbiting a pulsing center circle, on black. Orbit period
 * matches the clip duration so the loop is seamless.
 */
function generateShapesOrbit( outputPath ) {
  const duration = 6;
  const c = SIZE / 2;
  const orbit = `2*PI*T/${ duration }`;
  // Soft-edged disc: full luma inside radius, 8 px linear falloff.
  const disc = (
    cx, cy, radius
  ) =>
    `clip((${ radius }-hypot(X-(${ cx }),Y-(${ cy })))/8,0,1)`;
  const lum = [
    disc(
      `${ c }+190*cos(${ orbit })`,
      `${ c }+190*sin(${ orbit })`,
      "84"
    ),
    disc(
      `${ c }+190*cos(${ orbit }+PI)`,
      `${ c }+190*sin(${ orbit }+PI)`,
      "84"
    ),
    disc(
      `${ c }`,
      `${ c }`,
      `(60+25*sin(2*PI*T/${ duration / 2 }))`
    )
  ].join( "+" );

  ffmpeg( [
    "-f",
    "lavfi",
    "-i",
    `nullsrc=s=${ SIZE }x${ SIZE }:d=${ duration }:r=${ FPS }`,
    "-vf",
    `geq=lum='16+219*clip(${ lum },0,1)':cb=128:cr=128`,
    ...encodeArgs,
    outputPath
  ] );
}

/**
 * Ken Burns slideshow over the first four default test photos: each image
 * slowly zooms (alternating in / out) and crossfades into the next.
 */
function generatePhotosZoom( outputPath ) {
  const clipSeconds = 2.5;
  const fadeSeconds = 0.5;
  const framesPerClip = clipSeconds * FPS;

  const images = fs
    .readdirSync( testImagesDir )
    .filter( ( f ) => /\.(jpe?g|png|webp)$/i.test( f ) )
    .sort()
    .slice(
      0,
      4
    )
    .map( ( f ) => path.join(
      testImagesDir,
      f
    ) );

  if ( images.length < 2 ) {
    throw new Error( `Need at least 2 test images in ${ testImagesDir }` );
  }

  // Oversample to 1.5x before zoompan so the zoom does not look soft.
  const pre = `scale=${ SIZE * 1.5 }:${ SIZE * 1.5 }:force_original_aspect_ratio=increase,crop=${ SIZE * 1.5 }:${ SIZE * 1.5 }`;
  const center = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'";
  const clips = images.map( (
    _, i
  ) => {
    const zoom =
      i % 2 === 0
        ? `1+0.10*on/${ framesPerClip - 1 }`
        : `1.10-0.10*on/${ framesPerClip - 1 }`;

    return `[${ i }:v]${ pre },zoompan=z='${ zoom }':d=${ framesPerClip }:${ center }:s=${ SIZE }x${ SIZE }:fps=${ FPS },settb=AVTB[v${ i }]`;
  } );

  // Chain crossfades: each transition starts `fadeSeconds` before the
  // running total of fully-visible clip time runs out.
  const fades = [];

  for ( let i = 1; i < images.length; i++ ) {
    const from = i === 1 ? "[v0]" : `[x${ i - 1 }]`;
    const to = i === images.length - 1 ? "[xo]" : `[x${ i }]`;
    const offset = i * ( clipSeconds - fadeSeconds );

    fades.push( `${ from }[v${ i }]xfade=transition=fade:duration=${ fadeSeconds }:offset=${ offset }${ to }` );
  }

  ffmpeg( [
    ...images.flatMap( ( image ) => [
      "-i",
      image
    ] ),
    "-filter_complex",
    [
      ...clips,
      ...fades,
      "[xo]format=yuv420p[out]"
    ].join( ";" ),
    "-map",
    "[out]",
    ...encodeArgs,
    outputPath
  ] );
}

fs.mkdirSync(
  outputDir,
  {
    recursive: true
  }
);

const generators = [
  [
    "gradient-flow.mp4",
    generateGradientFlow
  ],
  [
    "photos-zoom.mp4",
    generatePhotosZoom
  ],
  [
    "shapes-orbit.mp4",
    generateShapesOrbit
  ]
];

for ( const [
  fileName,
  generate
] of generators ) {
  const outputPath = path.join(
    outputDir,
    fileName
  );

  console.log( `Generating ${ fileName }…` );
  generate( outputPath );

  const kb = Math.round( fs.statSync( outputPath ).size / 1024 );

  console.log( `✓ ${ fileName } (${ kb } KB)` );
}
