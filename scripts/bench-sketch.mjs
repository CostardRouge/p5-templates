#!/usr/bin/env node

/**
 * Bench a sketch: time deterministic frames headlessly, dump them, diff two
 * dumps.
 *
 * Usage (production server running on :3000 — `npm run build && npm start`):
 *
 *   node scripts/bench-sketch.mjs --sketch p5/sculpt/sculpt-v2-letter-relief \
 *     --size 540x675 --frames 24 --options '{"interaction":{"mouse":{"enabled":false}}}' \
 *     [--dump tmp/bench/v2-before] [--gpu] [--base http://localhost:3000]
 *
 *   node scripts/bench-sketch.mjs --diff tmp/bench/v2-before tmp/bench/v2-after
 *
 * The page is the `/embed` route with the option delta in `#o=` (the same
 * base64url JSON as `encodeEmbedOptions` in src/lib/embedOptions.ts — inlined
 * here because that module is TypeScript) and the canvas size in `#s=`.
 * Frames are rendered through the engine's headless-capture controller
 * (`window.__sketchCapture`, src/engines/recording/serverCapture.ts): the
 * recording clock is pinned to the frame index, so frame k is the same
 * pixels in every build and the dumps of two builds compare pixel for pixel.
 * The canvas read after each frame is what forces the GPU to finish, so the
 * time per frame includes the shader.
 *
 * Fails closed: a GLSL compile failure is only a console error after which the
 * canvas stays background (a broken shader would bench as the fastest build
 * ever), so any console error or page error, or a frame with no lit pixel,
 * exits non-zero.
 *
 * Without `--gpu` the browser runs SwiftShader (software GL): it prices a
 * texture fetch higher than a real GPU does relative to arithmetic, so its
 * numbers are before/after ratios and correctness, not desktop frame times.
 * `--gpu` drops the software-GL flags to bench on the machine's own GPU.
 */

import fs from "fs/promises";
import path from "path";
import {
  chromium
} from "playwright";

const DEFAULTS = {
  base: "http://localhost:3000",
  size: "540x675",
  frames: 24,
  warmup: 4,
  settle: 2000,
  timeout: 120000
};

function parseArgs( argv ) {
  const args = {
    ...DEFAULTS
  };
  const positional = [];

  for ( let i = 0; i < argv.length; i++ ) {
    const arg = argv[ i ];

    if ( !arg.startsWith( "--" ) ) {
      positional.push( arg );
      continue;
    }

    const key = arg.slice( 2 );

    if ( key === "gpu" ) {
      args.gpu = true;
    } else if ( key === "diff" ) {
      args.diff = [
        argv[ ++i ],
        argv[ ++i ]
      ];
    } else {
      args[ key ] = argv[ ++i ];
    }
  }

  args.frames = Number( args.frames );
  args.warmup = Number( args.warmup );
  args.settle = Number( args.settle );
  args.timeout = Number( args.timeout );

  return args;
}

function encodeOptions( delta ) {
  return Buffer.from(
    JSON.stringify( delta ),
    "utf8"
  ).toString( "base64url" );
}

function parseSize( value ) {
  const match = /^(\d+)x(\d+)$/.exec( value );

  if ( !match ) {
    throw new Error( `--size expects WxH, got "${ value }"` );
  }

  return {
    width: Number( match[ 1 ] ),
    height: Number( match[ 2 ] )
  };
}

function stats( values ) {
  const sorted = [
    ...values
  ].sort( (
    a, b
  ) => a - b );
  const sum = sorted.reduce(
    (
      acc, v
    ) => acc + v,
    0
  );

  return {
    min: sorted[ 0 ],
    median: sorted[ Math.floor( sorted.length / 2 ) ],
    mean: sum / sorted.length,
    max: sorted[ sorted.length - 1 ]
  };
}

function chromiumPath() {
  if ( process.env.PW_CHROMIUM ) {
    return process.env.PW_CHROMIUM;
  }

  const bundled = "/opt/pw-browsers/chromium";

  return fs.access( bundled ).then(
    () => bundled,
    () => undefined
  );
}

async function bench( args ) {
  if ( !args.sketch ) {
    throw new Error( "--sketch <engine/category/name> is required" );
  }

  const size = parseSize( args.size );
  const delta = args.options ? JSON.parse( args.options ) : {};
  const hash = `#o=${ encodeOptions( delta ) }&s=${ size.width }x${ size.height }`;
  const url = `${ args.base }/embed/${ args.sketch }${ hash }`;
  const executablePath = await chromiumPath();
  const browser = await chromium.launch( {
    executablePath,
    args: args.gpu
      ? [
        "--ignore-gpu-blocklist"
      ]
      : [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader"
      ]
  } );
  const context = await browser.newContext( {
    viewport: size
  } );
  const page = await context.newPage();
  const problems = [];

  page.on(
    "console",
    ( message ) => {
      // A blocked third-party resource (analytics, a font) is the network,
      // not the sketch: everything else that reaches console.error fails the run.
      if ( message.type() === "error" && !/Failed to load resource: net::/.test( message.text() ) ) {
        problems.push( `console.error: ${ message.text() }` );
      }
    }
  );
  page.on(
    "pageerror",
    ( error ) => {
      problems.push( `pageerror: ${ error.message }` );
    }
  );

  console.log( `bench ${ args.sketch } ${ size.width }x${ size.height } ${ args.gpu ? "gpu" : "swiftshader" }` );
  console.log( `  ${ url }` );

  try {
    await page.goto(
      url,
      {
        waitUntil: "domcontentloaded",
        timeout: args.timeout
      }
    );
    await page.waitForFunction(
      () => Boolean( window.__sketchCapture ) && Boolean( document.querySelector( "canvas.p5Canvas" ) ),
      null,
      {
        timeout: args.timeout
      }
    );
    // Let the first live frames land (shader compile, lattice memo) before the
    // clock is pinned, so the warm-up measures frames and not the compile.
    await page.waitForTimeout( args.settle );
    await page.evaluate( () => window.__sketchCapture.prepare() );

    const times = [];
    const litFractions = [];

    if ( args.dump ) {
      await fs.mkdir(
        args.dump,
        {
          recursive: true
        }
      );
    }

    for ( let frame = 0; frame < args.warmup + args.frames; frame++ ) {
      const measured = frame >= args.warmup;
      const result = await page.evaluate(
        async( {
          index, wantPixels
        } ) => {
          const canvas = document.querySelector( "canvas.p5Canvas" );
          const started = performance.now();

          await window.__sketchCapture.renderFrame( index );

          // Reading the canvas is what waits for the GPU.
          const png = canvas.toDataURL( "image/png" );
          const elapsed = performance.now() - started;
          const ctx = canvas.getContext( "2d" );
          const image = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );
          let lit = 0;

          for ( let i = 0; i < image.data.length; i += 4 ) {
            if ( image.data[ i ] > 16 || image.data[ i + 1 ] > 16 || image.data[ i + 2 ] > 16 ) {
              lit++;
            }
          }

          let rgba = null;

          if ( wantPixels ) {
            let binary = "";
            const bytes = image.data;

            for ( let i = 0; i < bytes.length; i += 0x8000 ) {
              binary += String.fromCharCode.apply(
                null,
                bytes.subarray(
                  i,
                  i + 0x8000
                )
              );
            }

            rgba = btoa( binary );
          }

          return {
            elapsed,
            lit: lit / ( image.data.length / 4 ),
            width: canvas.width,
            height: canvas.height,
            png: wantPixels ? png : null,
            rgba
          };
        },
        {
          index: frame,
          wantPixels: Boolean( args.dump ) && measured
        }
      );

      if ( measured ) {
        times.push( result.elapsed );
        litFractions.push( result.lit );
      }

      if ( result.png ) {
        const name = `frame_${ String( frame - args.warmup ).padStart(
          4,
          "0"
        ) }`;

        await fs.writeFile(
          path.join(
            args.dump,
            `${ name }.png`
          ),
          Buffer.from(
            result.png.replace(
              /^data:image\/png;base64,/,
              ""
            ),
            "base64"
          )
        );
        await fs.writeFile(
          path.join(
            args.dump,
            `${ name }.rgba`
          ),
          Buffer.from(
            result.rgba,
            "base64"
          )
        );
        await fs.writeFile(
          path.join(
            args.dump,
            "meta.json"
          ),
          JSON.stringify( {
            sketch: args.sketch,
            options: delta,
            width: result.width,
            height: result.height,
            frames: args.frames
          } )
        );
      }
    }

    const timing = stats( times );
    const lit = stats( litFractions );

    console.log( `  ms/frame  min ${ timing.min.toFixed( 1 ) }  median ${ timing.median.toFixed( 1 ) }  mean ${ timing.mean.toFixed( 1 ) }  max ${ timing.max.toFixed( 1 ) }  (${ times.length } frames after ${ args.warmup } warm-up)` );
    console.log( `  lit       min ${ ( lit.min * 100 ).toFixed( 2 ) }%  mean ${ ( lit.mean * 100 ).toFixed( 2 ) }%` );

    if ( problems.length ) {
      console.error( `  FAIL: ${ problems.length } problem(s)` );
      problems.forEach( ( problem ) => console.error( `    ${ problem }` ) );
      process.exitCode = 2;
    } else if ( lit.max === 0 ) {
      console.error( "  FAIL: no lit pixel on any measured frame — the shader did not render" );
      process.exitCode = 3;
    }
  } finally {
    await browser.close();
  }
}

async function diff( [
  dirA,
  dirB
] ) {
  const metaA = JSON.parse( await fs.readFile(
    path.join(
      dirA,
      "meta.json"
    ),
    "utf8"
  ) );
  const metaB = JSON.parse( await fs.readFile(
    path.join(
      dirB,
      "meta.json"
    ),
    "utf8"
  ) );

  if ( metaA.width !== metaB.width || metaA.height !== metaB.height ) {
    throw new Error( `size mismatch: ${ metaA.width }x${ metaA.height } vs ${ metaB.width }x${ metaB.height }` );
  }

  const frames = Math.min(
    metaA.frames,
    metaB.frames
  );
  const pixels = metaA.width * metaA.height;

  console.log( `diff ${ dirA } vs ${ dirB } — ${ frames } frames of ${ metaA.width }x${ metaA.height }` );
  console.log( "  frame  differing   >8lv   >40lv  maxΔ  litA%  litB%" );

  let worst = 0;

  for ( let frame = 0; frame < frames; frame++ ) {
    const name = `frame_${ String( frame ).padStart(
      4,
      "0"
    ) }.rgba`;
    const a = await fs.readFile( path.join(
      dirA,
      name
    ) );
    const b = await fs.readFile( path.join(
      dirB,
      name
    ) );
    let differing = 0;
    let over8 = 0;
    let over40 = 0;
    let maxDelta = 0;
    let litA = 0;
    let litB = 0;

    for ( let i = 0; i < a.length; i += 4 ) {
      const delta = Math.max(
        Math.abs( a[ i ] - b[ i ] ),
        Math.abs( a[ i + 1 ] - b[ i + 1 ] ),
        Math.abs( a[ i + 2 ] - b[ i + 2 ] )
      );

      if ( delta > 0 ) {
        differing++;
      }
      if ( delta > 8 ) {
        over8++;
      }
      if ( delta > 40 ) {
        over40++;
      }
      if ( delta > maxDelta ) {
        maxDelta = delta;
      }
      if ( a[ i ] > 16 || a[ i + 1 ] > 16 || a[ i + 2 ] > 16 ) {
        litA++;
      }
      if ( b[ i ] > 16 || b[ i + 1 ] > 16 || b[ i + 2 ] > 16 ) {
        litB++;
      }
    }

    worst = Math.max(
      worst,
      maxDelta
    );
    console.log( `  ${ String( frame ).padStart( 5 ) }  ${ ( 100 * differing / pixels ).toFixed( 3 ).padStart( 8 ) }%  ${ String( over8 ).padStart( 5 ) }  ${ String( over40 ).padStart( 6 ) }  ${ String( maxDelta ).padStart( 4 ) }  ${ ( 100 * litA / pixels ).toFixed( 2 ).padStart( 5 ) }  ${ ( 100 * litB / pixels ).toFixed( 2 ).padStart( 5 ) }` );
  }

  console.log( `  worst channel delta over all frames: ${ worst }` );
}

const args = parseArgs( process.argv.slice( 2 ) );

( args.diff ? diff( args.diff ) : bench( args ) ).catch( ( error ) => {
  console.error( error.message );
  process.exitCode = 1;
} );
