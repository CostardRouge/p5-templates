#!/usr/bin/env node

/**
 * Front vs back recording, measured: the same sketch, the same frames, the
 * same size, encoded to H.264 MP4 by each of the two pipelines the app has.
 *
 * Usage (a server on :3000 — `npm run dev`, or better `npm run build && npm start`):
 *
 *   node scripts/bench-recording.mjs --sketch p5/voronoi/voronoi-v1-cells \
 *     [--size 1080x1350] [--frames 60] [--fps 30] [--gpu] [--job] \
 *     [--modes render,png,raw,webcodecs] [--base http://localhost:3000]
 *
 * One page (the public `/embed` route, `#s=WxH`), one deterministic clock
 * (`window.__sketchCapture`: frame k is the same pixels in every mode), then
 * per mode N frames:
 *
 *   render     draw only, plus a 1×1 read that makes the GPU finish — the floor
 *              every pipeline pays.
 *   png        the BACKEND path: `canvas.toDataURL( "image/png" )` in the page,
 *              base64 over the DevTools protocol to Node, piped into FFmpeg
 *              (`-f image2pipe` → libx264, the recorder's own arguments,
 *              `recorderFfmpegArgs` in src/utils/captureFramesWithStreaming.ts).
 *              Memory only, no disk — as the recorder streams.
 *   raw        the same pipe without PNG: `getImageData` RGBA → FFmpeg
 *              `-f rawvideo`. Answers "is the PNG step the expensive part?".
 *   jpeg       the same pipe with `toDataURL( "image/jpeg", 0.92 )`: the
 *              cheapest readback the canvas offers, lossy before the encoder.
 *   webcodecs  the FRONT path: mediabunny's `CanvasSource` → WebCodecs
 *              `VideoEncoder` → MP4 in the page, as `MediabunnyEncoder` does
 *              (src/engines/recording/encoders/MediabunnyEncoder.ts, same
 *              bitrate), falling back to WebM/VP9 when the browser has no H.264
 *              encoder (Playwright's Chromium often has none).
 *
 * `--job` also posts a real backend job (`/api/recordings/enqueue`, needs
 * Redis, Postgres and S3) and reports the server's own `recordingDuration`:
 * the pipeline as it ships — browser launch, page load, the recorder's 10 ms
 * wait per frame, upload — not only the encode.
 *
 * Read the numbers where they are measured: without `--gpu` the browser draws
 * WebGL on SwiftShader and WebCodecs encodes in software, so the FRONT column
 * is the pessimistic one; on a Mac or a phone it uses the GPU and the hardware
 * encoder. FFmpeg's libx264 is CPU everywhere.
 */

import {
  spawn
} from "child_process";
import fs from "fs/promises";
import path from "path";
import {
  fileURLToPath
} from "url";
import {
  chromium
} from "playwright";

const ROOT = path.resolve(
  path.dirname( fileURLToPath( import.meta.url ) ),
  ".."
);
const DEFAULTS = {
  base: "http://localhost:3000",
  size: "1080x1350",
  frames: 60,
  fps: 30,
  settle: 1500,
  timeout: 180000,
  modes: "render,png,jpeg,raw,webcodecs"
};

function parseArgs( argv ) {
  const args = {
    ...DEFAULTS
  };

  for ( let i = 0; i < argv.length; i++ ) {
    const key = argv[ i ].replace(
      /^--/,
      ""
    );

    if ( key === "gpu" || key === "job" ) {
      args[ key ] = true;
      continue;
    }
    args[ key ] = argv[ ++i ];
  }

  if ( !args.sketch ) {
    throw new Error( "--sketch <engine/category/name> is required" );
  }

  const match = /^(\d+)x(\d+)$/.exec( args.size );

  if ( !match ) {
    throw new Error( `--size expects WxH, got "${ args.size }"` );
  }

  return {
    ...args,
    width: Number( match[ 1 ] ),
    height: Number( match[ 2 ] ),
    frames: Number( args.frames ),
    fps: Number( args.fps ),
    settle: Number( args.settle ),
    timeout: Number( args.timeout ),
    modes: args.modes.split( "," )
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

/** FFmpeg reading frames from stdin, encoding as the recorder does. */
function startFfmpeg(
  input, fps, output
) {
  const child = spawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      ...input,
      "-framerate",
      String( fps ),
      "-i",
      "pipe:0",
      "-vf",
      "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      output
    ]
  );
  let stderr = "";

  child.stderr.on(
    "data",
    ( chunk ) => {
      stderr += chunk;
    }
  );

  const done = new Promise( (
    resolve, reject
  ) => {
    child.on(
      "error",
      reject
    );
    child.on(
      "close",
      ( code ) => code === 0 ? resolve() : reject( new Error( `ffmpeg exited ${ code }: ${ stderr }` ) )
    );
  } );

  return {
    child,
    done
  };
}

function write(
  stream, buffer
) {
  return stream.write( buffer ) ? Promise.resolve() : new Promise( ( resolve ) => stream.once(
    "drain",
    resolve
  ) );
}

async function openSketch(
  browser, args
) {
  const context = await browser.newContext( {
    viewport: {
      width: args.width,
      height: args.height
    },
    deviceScaleFactor: 1
  } );
  const page = await context.newPage();
  const url = `${ args.base }/embed/${ args.sketch }#o=${ Buffer.from( "{}" ).toString( "base64url" ) }&s=${ args.width }x${ args.height }`;

  await page.goto(
    url,
    {
      waitUntil: "domcontentloaded",
      timeout: args.timeout
    }
  );
  await page.waitForFunction(
    () => window.__sketchCapture && document.querySelector( window.__sketchCapture.surfaceSelector ),
    null,
    {
      timeout: args.timeout
    }
  );
  await page.waitForTimeout( args.settle );

  const kind = await page.evaluate( () => window.__sketchCapture.captureKind );

  if ( kind !== "canvas" ) {
    throw new Error( `${ args.sketch } captures as "${ kind }": this bench compares canvas pipelines only` );
  }

  await page.evaluate( () => window.__sketchCapture.prepare() );

  return {
    context,
    page
  };
}

async function benchRender(
  page, args
) {
  return page.evaluate(
    async( frames ) => {
      const controller = window.__sketchCapture;
      const canvas = document.querySelector( controller.surfaceSelector );
      const probe = document.createElement( "canvas" ).getContext( "2d" );
      const started = performance.now();

      for ( let i = 0; i < frames; i++ ) {
        await controller.renderFrame( i );
        probe.drawImage(
          canvas,
          0,
          0,
          1,
          1
        );
        probe.getImageData(
          0,
          0,
          1,
          1
        );
      }

      return {
        ms: performance.now() - started
      };
    },
    args.frames
  );
}

/** The backend's readback: render + a whole-frame read, piped to FFmpeg. */
async function benchPipe(
  page, args, kind, output
) {
  const ffmpeg = startFfmpeg(
    kind === "png" || kind === "jpeg"
      ? [
        "-f",
        "image2pipe"
      ]
      : [
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${ args.width }x${ args.height }`
      ],
    args.fps,
    output
  );
  const parts = {
    render: 0,
    read: 0,
    transfer: 0,
    pipe: 0
  };
  const started = performance.now();

  for ( let i = 0; i < args.frames; i++ ) {
    const before = performance.now();
    const frame = await page.evaluate(
      async( {
        index, kind
      } ) => {
        const controller = window.__sketchCapture;
        const canvas = document.querySelector( controller.surfaceSelector );
        const t0 = performance.now();

        await controller.renderFrame( index );

        const t1 = performance.now();
        let data;

        if ( kind === "png" || kind === "jpeg" ) {
          const url = canvas.toDataURL(
            `image/${ kind }`,
            0.92
          );

          data = url.slice( url.indexOf( "," ) + 1 );
        } else {
          // A WebGL canvas cannot hand out a 2D context: copy it into one.
          const copy = document.createElement( "canvas" );

          copy.width = canvas.width;
          copy.height = canvas.height;

          const ctx = copy.getContext( "2d" );

          ctx.drawImage(
            canvas,
            0,
            0
          );

          const bytes = ctx.getImageData(
            0,
            0,
            copy.width,
            copy.height
          ).data;
          let binary = "";

          for ( let j = 0; j < bytes.length; j += 0x8000 ) {
            binary += String.fromCharCode.apply(
              null,
              bytes.subarray(
                j,
                j + 0x8000
              )
            );
          }
          data = btoa( binary );
        }

        return {
          data,
          render: t1 - t0,
          read: performance.now() - t1
        };
      },
      {
        index: i,
        kind
      }
    );
    const received = performance.now();

    parts.render += frame.render;
    parts.read += frame.read;
    parts.transfer += received - before - frame.render - frame.read;
    await write(
      ffmpeg.child.stdin,
      Buffer.from(
        frame.data,
        "base64"
      )
    );
    parts.pipe += performance.now() - received;
  }

  const captured = performance.now();

  ffmpeg.child.stdin.end();
  await ffmpeg.done;

  const stat = await fs.stat( output );

  return {
    ms: performance.now() - started,
    parts: {
      ...parts,
      encodeTail: performance.now() - captured
    },
    bytes: stat.size
  };
}

/** The front path: mediabunny + WebCodecs in the page, as MediabunnyEncoder does. */
async function benchWebcodecs(
  page, args, output
) {
  const bundle = await fs.readFile(
    path.join(
      ROOT,
      "node_modules/mediabunny/dist/bundles/mediabunny.min.mjs"
    ),
    "utf8"
  );
  const result = await page.evaluate(
    async( {
      source, frames, fps
    } ) => {
      const mb = await import( URL.createObjectURL( new Blob(
        [
          source
        ],
        {
          type: "text/javascript"
        }
      ) ) );
      const controller = window.__sketchCapture;
      const canvas = document.querySelector( controller.surfaceSelector );
      let container = "mp4";
      let codec = await mb.getFirstEncodableVideoCodec(
        [
          "avc"
        ],
        {
          width: canvas.width,
          height: canvas.height
        }
      );

      if ( !codec ) {
        container = "webm";
        codec = await mb.getFirstEncodableVideoCodec(
          [
            "vp9",
            "vp8"
          ],
          {
            width: canvas.width,
            height: canvas.height
          }
        );
      }
      if ( !codec ) {
        return {
          error: "this browser has no WebCodecs video encoder"
        };
      }

      const output = new mb.Output( {
        format: container === "mp4" ? new mb.Mp4OutputFormat() : new mb.WebMOutputFormat(),
        target: new mb.BufferTarget()
      } );
      const videoSource = new mb.CanvasSource(
        canvas,
        {
          codec,
          bitrate: 8_000_000,
          sizeChangeBehavior: "contain"
        }
      );

      output.addVideoTrack( videoSource );
      await output.start();

      const started = performance.now();
      let render = 0;

      for ( let i = 0; i < frames; i++ ) {
        const t0 = performance.now();

        await controller.renderFrame( i );
        render += performance.now() - t0;
        await videoSource.add(
          i / fps,
          1 / fps
        );
      }

      const captured = performance.now();

      await output.finalize();

      const bytes = new Uint8Array( output.target.buffer );
      let binary = "";

      for ( let j = 0; j < bytes.length; j += 0x8000 ) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(
            j,
            j + 0x8000
          )
        );
      }

      return {
        ms: performance.now() - started,
        parts: {
          render,
          encode: captured - started - render,
          encodeTail: performance.now() - captured
        },
        codec,
        container,
        file: btoa( binary )
      };
    },
    {
      source: bundle,
      frames: args.frames,
      fps: args.fps
    }
  );

  if ( result.error ) {
    return result;
  }

  const file = output.replace(
    /\.mp4$/,
    `.${ result.container }`
  );

  await fs.writeFile(
    file,
    Buffer.from(
      result.file,
      "base64"
    )
  );

  return {
    ms: result.ms,
    parts: result.parts,
    bytes: ( await fs.stat( file ) ).size,
    note: `${ result.codec } in ${ result.container }`
  };
}

/** A real backend job, timed by the server itself. */
async function benchJob( args ) {
  const body = new FormData();

  body.set(
    "sketch",
    `sketches/${ args.sketch }`
  );
  body.set(
    "status",
    "queued"
  );
  body.set(
    "options",
    JSON.stringify( {
      size: {
        width: args.width,
        height: args.height
      },
      animation: {
        framerate: args.fps,
        duration: args.frames / args.fps
      }
    } )
  );

  const started = performance.now();
  const answer = await ( await fetch(
    `${ args.base }/api/recordings/enqueue`,
    {
      method: "POST",
      body
    }
  ) ).json();

  if ( !answer.success ) {
    return {
      error: answer.error
    };
  }

  for ( ;; ) {
    const job = await ( await fetch( `${ args.base }/api/recordings/${ answer.jobId }` ) ).json();

    if ( job.status === "completed" || job.status === "failed" ) {
      return job.status === "completed"
        ? {
          ms: performance.now() - started,
          parts: {
            serverRecording: job.recordingDuration
          },
          note: `job ${ answer.jobId }`
        }
        : {
          error: job.error ?? "failed"
        };
    }
    await new Promise( ( resolve ) => setTimeout(
      resolve,
      500
    ) );
  }
}

function row(
  name, result, args
) {
  if ( result.error ) {
    return `| ${ name } | — | — | — | ${ result.error } |`;
  }

  const seconds = result.ms / 1000;
  const realtime = ( args.frames / args.fps ) / seconds;
  const parts = Object.entries( result.parts ?? {} )
    .map( ( [
      key,
      ms
    ] ) => `${ key } ${ ( ms / args.frames ).toFixed( 1 ) }` )
    .join( ", " );

  return `| ${ name } | ${ seconds.toFixed( 2 ) } s | ${ ( result.ms / args.frames ).toFixed( 1 ) } ms | ${ realtime.toFixed( 2 ) }× | ${ [
    parts ? `ms/frame: ${ parts }` : "",
    result.bytes ? `${ ( result.bytes / 1e6 ).toFixed( 2 ) } MB` : "",
    result.note ?? ""
  ].filter( Boolean ).join( " · " ) } |`;
}

async function main() {
  const args = parseArgs( process.argv.slice( 2 ) );
  const out = path.join(
    ROOT,
    "tmp",
    "bench-recording"
  );

  await fs.mkdir(
    out,
    {
      recursive: true
    }
  );

  const browser = await chromium.launch( {
    executablePath: await chromiumPath(),
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
  const rows = [];

  try {
    const {
      context, page
    } = await openSketch(
      browser,
      args
    );
    const stem = path.join(
      out,
      args.sketch.replace(
        /\//g,
        "-"
      )
    );

    // A warm-up pass, so the first mode does not pay the shader compile.
    await benchRender(
      page,
      {
        ...args,
        frames: Math.min(
          args.frames,
          5
        )
      }
    );

    for ( const mode of args.modes ) {
      const result = mode === "render"
        ? await benchRender(
          page,
          args
        )
        : mode === "png" || mode === "raw" || mode === "jpeg"
          ? await benchPipe(
            page,
            args,
            mode,
            `${ stem }-${ mode }.mp4`
          )
          : mode === "webcodecs"
            ? await benchWebcodecs(
              page,
              args,
              `${ stem }-webcodecs.mp4`
            )
            : {
              error: `unknown mode ${ mode }`
            };

      rows.push( row(
        {
          render: "draw only (floor)",
          png: "BACK · PNG → FFmpeg libx264",
          raw: "back · raw RGBA → FFmpeg libx264",
          jpeg: "back · JPEG q0.92 → FFmpeg libx264",
          webcodecs: "FRONT · WebCodecs (mediabunny)"
        }[ mode ] ?? mode,
        result,
        args
      ) );
    }

    await context.close();
  } finally {
    await browser.close();
  }

  if ( args.job ) {
    rows.push( row(
      "BACK · real job, as shipped",
      await benchJob( args ),
      args
    ) );
  }

  console.log( `\n${ args.sketch } — ${ args.width }×${ args.height }, ${ args.frames } frames at ${ args.fps } fps (${ ( args.frames / args.fps ).toFixed( 1 ) } s of video), ${ args.gpu ? "GPU" : "SwiftShader (software GL + software WebCodecs)" }\n` );
  console.log( "| pipeline | total | per frame | speed vs real time | detail |" );
  console.log( "| --- | --- | --- | --- | --- |" );
  for ( const line of rows ) {
    console.log( line );
  }
}

main().catch( ( error ) => {
  console.error( error );
  process.exit( 1 );
} );
