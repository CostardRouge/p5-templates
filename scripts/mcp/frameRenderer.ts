/**
 * One frame of a sketch, rendered the way the recorder renders it, for an
 * agent to look at.
 *
 * Headless Chromium opens the PUBLIC `/embed/<id>` route with the parameter
 * delta in `#o=` and the canvas size in `s=` (the contract
 * `src/lib/embedOptions.ts` documents), then drives the page's
 * `window.__sketchCapture` exactly as `src/lib/recordSketch.ts` does —
 * `prepare()`, `renderFrame( i )`, read the surface — so frame `i` here is
 * frame `i` of an export. `scripts/bench-sketch.mjs` is the same recipe.
 *
 * One browser is kept for the life of the MCP server (a cold Chromium costs a
 * second or two), one context per frame (nothing leaks between renders).
 */
import fs from "node:fs/promises";

import type {
  Browser
} from "playwright";

export interface FrameRequest {
  /** `<engine>/<category>/<name>`. */
  id: string;
  /** Parameter delta over the sketch's defaults (already checked). */
  options: Record<string, unknown>;
  /** Canvas size; absent → the sketch's own. */
  size?: { width: number;
    height: number };
  /** Exactly one of these places the frame; none → frame 0. */
  frame?: number;
  time?: number;
  progress?: number;
  format: "jpeg" | "png";
  /** Longest edge of the picture handed back (the saved file stays full size). */
  maxEdge: number;
  /** Write the full-size PNG here. */
  savePath?: string;
  /** Live frames to let land before the clock is pinned (shader compile, image decode). */
  settleMs: number;
  timeoutMs: number;
}

export interface FrameTiming {
  frameRate: number;
  duration: number;
  totalFrames: number;
}

export interface FrameResult {
  mimeType: "image/jpeg" | "image/png";
  data: string;
  width: number;
  height: number;
  /** The canvas's own size, before `maxEdge`. */
  sourceWidth: number;
  sourceHeight: number;
  frame: number;
  timing: FrameTiming | null;
  url: string;
  /** Console errors and page errors seen while rendering. */
  problems: string[];
}

/**
 * The frame index a request asks for, given the page's clock. Out of the loop
 * is refused (an agent asking for second 20 of a 12 s loop should hear that the
 * loop is 12 s long), not wrapped. Throws a plain `Error` with the reason.
 */
export function frameIndexFor(
  request: Pick<FrameRequest, "frame" | "time" | "progress">, timing: FrameTiming | null
): number {
  const given = [
    "frame",
    "time",
    "progress"
  ].filter( ( k ) => request[ k as keyof typeof request ] !== undefined );

  if ( given.length > 1 ) {
    throw new Error( `give one of frame, time, progress — got ${ given.join( " and " ) }` );
  }

  const loop = timing ? `the loop is ${ timing.totalFrames } frames (${ timing.duration } s at ${ timing.frameRate } fps)` : "";
  let index = 0;

  if ( request.frame !== undefined ) {
    index = request.frame;
  } else if ( request.time !== undefined || request.progress !== undefined ) {
    if ( !timing ) {
      throw new Error( "this server does not report its sketch clock (window.__sketchCapture.timing) — pass `frame` instead" );
    }
    index = request.time !== undefined
      ? Math.round( request.time * timing.frameRate )
      : Math.round( ( request.progress as number ) * timing.totalFrames );
  }

  if ( timing && index > timing.totalFrames ) {
    throw new Error( `frame ${ index } is past the end — ${ loop }` );
  }

  return index;
}

/** The `#o=` token: base64url of the JSON delta (`encodeEmbedOptions`). */
export function encodeEmbedOptions( delta: Record<string, unknown> ): string {
  return Buffer.from(
    JSON.stringify( delta ),
    "utf8"
  ).toString( "base64url" );
}

export function embedUrl(
  baseUrl: string, id: string, options: Record<string, unknown>, size?: { width: number;
    height: number }
): string {
  const hash = [
    `o=${ encodeEmbedOptions( options ) }`
  ];

  if ( size ) {
    hash.push( `s=${ size.width }x${ size.height }` );
  }

  return `${ baseUrl.replace(
    /\/+$/,
    ""
  ) }/embed/${ id }#${ hash.join( "&" ) }`;
}

async function chromiumPath(): Promise<string | undefined> {
  if ( process.env.PW_CHROMIUM ) {
    return process.env.PW_CHROMIUM;
  }

  // The cloud containers' pre-installed browser; elsewhere Playwright finds its own.
  const bundled = "/opt/pw-browsers/chromium";

  return fs.access( bundled ).then(
    () => bundled,
    () => undefined
  );
}

export class FrameRenderer {
  private browser: Promise<Browser> | null = null;
  private readonly baseUrl: string;

  constructor( baseUrl: string ) {
    this.baseUrl = baseUrl;
  }

  private launch(): Promise<Browser> {
    if ( !this.browser ) {
      this.browser = ( async() => {
        const {
          chromium
        } = await import( "playwright" );

        return chromium.launch( {
          executablePath: await chromiumPath(),
          // The recorder's own flags (`createBrowserPage`): WebGL on SwiftShader.
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader"
          ]
        } );
      } )();
      this.browser.catch( () => {
        this.browser = null;
      } );
    }

    return this.browser;
  }

  async close(): Promise<void> {
    const browser = this.browser;

    this.browser = null;
    if ( browser ) {
      await ( await browser ).close().catch( () => undefined );
    }
  }

  async render( request: FrameRequest ): Promise<FrameResult> {
    const browser = await this.launch();
    const url = embedUrl(
      this.baseUrl,
      request.id,
      request.options,
      request.size
    );
    const context = await browser.newContext( {
      viewport: request.size ?? {
        width: 1080,
        height: 1350
      },
      deviceScaleFactor: 1
    } );
    const problems: string[] = [];

    try {
      const page = await context.newPage();

      page.on(
        "console",
        ( message ) => {
        // A blocked third-party resource is the network, not the sketch.
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

      await page.goto(
        url,
        {
          waitUntil: "domcontentloaded",
          timeout: request.timeoutMs
        }
      );
      await page.waitForFunction(
        () => {
          const controller = window.__sketchCapture;

          return Boolean( controller ) && Boolean( document.querySelector( controller!.surfaceSelector ) )
            && ( window.isInteractionVisionReady?.() ?? true );
        },
        null,
        {
          timeout: request.timeoutMs
        }
      );
      await page.waitForTimeout( request.settleMs );

      const timing = await page.evaluate( () => window.__sketchCapture?.timing?.() ?? null );
      const frame = frameIndexFor(
        request,
        timing
      );
      const captured = await page.evaluate(
        async( index ) => {
          const controller = window.__sketchCapture!;

          controller.prepare();
          await controller.renderFrame( index );

          if ( controller.captureKind !== "canvas" ) {
            return null;
          }

          const canvas = document.querySelector( controller.surfaceSelector ) as HTMLCanvasElement;

          return canvas.toDataURL( "image/png" ).replace(
            /^data:image\/png;base64,/,
            ""
          );
        },
        frame
      );
      const png = captured ?? ( await page.locator( await page.evaluate( () => window.__sketchCapture!.surfaceSelector ) ).first()
        .screenshot( {
          type: "png"
        } ) ).toString( "base64" );

      if ( request.savePath ) {
        await fs.writeFile(
          request.savePath,
          Buffer.from(
            png,
            "base64"
          )
        );
      }

      // Scale and re-encode in the page: Chromium is already the image library at hand.
      const picture = await page.evaluate(
        async( {
          source, maxEdge, mimeType
        } ) => {
          const image = new Image();

          image.src = `data:image/png;base64,${ source }`;
          await image.decode();

          const scale = Math.min(
            1,
            maxEdge / Math.max(
              image.naturalWidth,
              image.naturalHeight
            )
          );
          const canvas = document.createElement( "canvas" );

          canvas.width = Math.max(
            1,
            Math.round( image.naturalWidth * scale )
          );
          canvas.height = Math.max(
            1,
            Math.round( image.naturalHeight * scale )
          );

          const ctx = canvas.getContext( "2d" )!;

          if ( mimeType === "image/jpeg" ) {
          // JPEG has no alpha: a transparent sketch reads against white, as a viewer would show it.
            ctx.fillStyle = "#fff";
            ctx.fillRect(
              0,
              0,
              canvas.width,
              canvas.height
            );
          }
          ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          return {
            data: canvas.toDataURL(
              mimeType,
              0.9
            ).replace(
              /^data:[^,]+,/,
              ""
            ),
            width: canvas.width,
            height: canvas.height,
            sourceWidth: image.naturalWidth,
            sourceHeight: image.naturalHeight
          };
        },
        {
          source: png,
          maxEdge: request.maxEdge,
          mimeType: request.format === "png" ? "image/png" : "image/jpeg"
        }
      );

      return {
        mimeType: request.format === "png" ? "image/png" : "image/jpeg",
        ...picture,
        frame,
        timing,
        url,
        problems
      };
    } finally {
      await context.close().catch( () => undefined );
    }
  }
}
