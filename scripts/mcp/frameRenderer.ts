/**
 * Frames of a sketch, rendered the way the recorder renders them, for an agent
 * to look at.
 *
 * Headless Chromium opens a page that runs the sketch — the PUBLIC `/embed`
 * route with a parameter delta in `#o=` and the size in `s=` (the contract
 * `src/lib/embedOptions.ts` documents), or a draft's studio page,
 * `/sketches/<id>?id=<draft>&capturing`, exactly the page the recorder loads —
 * then drives `window.__sketchCapture` as `src/lib/recordSketch.ts` does:
 * `prepare()`, `renderFrame( i )`, read the surface. So frame `i` here is
 * frame `i` of an export. `scripts/bench-sketch.mjs` is the same recipe.
 *
 * Several frames come from ONE page load (the costly part is loading and
 * compiling the sketch, not drawing it), and are handed back as one contact
 * sheet so the agent sees the whole series at once.
 *
 * One browser is kept for the life of the MCP server (a cold Chromium costs a
 * second or two), one context per request (nothing leaks between renders).
 */
import fs from "node:fs/promises";

import type {
  Browser
} from "playwright";

/** Exactly one of these places a frame; none → frame 0. */
export interface FramePlacement {
  frame?: number;
  time?: number;
  progress?: number;
}

export interface FrameRequest {
  /** The page to open: `embedUrl(…)` or a draft's capture URL. */
  url: string;
  /** The browser window; the canvas keeps its own size whatever this is. */
  viewport: { width: number;
    height: number };
  placements: FramePlacement[];
  format: "jpeg" | "png";
  /** Longest edge of the picture handed back (saved files stay full size). */
  maxEdge: number;
  /** One full-size PNG path per placement, or none. */
  savePaths?: string[];
  /** Live time before the clock is pinned (shader compile, image decode). */
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
  /** One frame, or a contact sheet of all of them in order. */
  data: string;
  width: number;
  height: number;
  /** The canvas's own size. */
  sourceWidth: number;
  sourceHeight: number;
  frames: number[];
  timing: FrameTiming | null;
  url: string;
  /** Console errors and page errors seen while rendering. */
  problems: string[];
}

/**
 * The frame index a placement asks for, given the page's clock. Out of the
 * loop is refused (an agent asking for second 20 of a 12 s loop should hear
 * that the loop is 12 s long), not wrapped. Throws a plain `Error` with the
 * reason.
 */
export function frameIndexFor(
  request: FramePlacement, timing: FrameTiming | null
): number {
  const given = [
    "frame",
    "time",
    "progress"
  ].filter( ( k ) => request[ k as keyof FramePlacement ] !== undefined );

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

/** Is this message one of `frameIndexFor`'s refusals (the request's fault, not the render's)? */
export function isPlacementRefusal( message: string ): boolean {
  return /^(give one of|frame \d+ is past|this server does not report)/.test( message );
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

/** The page the recorder itself loads for a stored job (`recordSketch.ts`). */
export function draftUrl(
  baseUrl: string, sketchPath: string, draftId: string
): string {
  return `${ baseUrl.replace(
    /\/+$/,
    ""
  ) }/${ sketchPath.replace(
    /^\/+/,
    ""
  ) }?id=${ encodeURIComponent( draftId ) }&capturing`;
}

/** Columns × rows for a contact sheet of `count` cells: as square as it gets. */
export function sheetGrid( count: number ): { columns: number;
  rows: number } {
  const columns = Math.ceil( Math.sqrt( Math.max(
    1,
    count
  ) ) );

  return {
    columns,
    rows: Math.ceil( Math.max(
      1,
      count
    ) / columns )
  };
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
    const context = await browser.newContext( {
      viewport: request.viewport,
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
        request.url,
        {
          waitUntil: "domcontentloaded",
          timeout: request.timeoutMs
        }
      );
      try {
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
      } catch( error ) {
        // A page that throws while it loads never becomes ready: say why
        // rather than only that the wait ran out.
        if ( problems.length ) {
          throw new Error( `the page never became ready — it reported: ${ problems.slice(
            0,
            3
          ).join( " | " ) }` );
        }
        throw error;
      }
      await page.waitForTimeout( request.settleMs );

      const timing = await page.evaluate( () => window.__sketchCapture?.timing?.() ?? null );
      const frames = request.placements.map( ( placement ) => frameIndexFor(
        placement,
        timing
      ) );
      const pngs: string[] = [];

      await page.evaluate( () => window.__sketchCapture!.prepare() );

      for ( const frame of frames ) {
        const captured = await page.evaluate(
          async( index ) => {
            const controller = window.__sketchCapture!;

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

        pngs.push( png );
      }

      if ( request.savePaths ) {
        await Promise.all( request.savePaths.map( (
          file, i
        ) => fs.writeFile(
          file,
          Buffer.from(
            pngs[ i ],
            "base64"
          )
        ) ) );
      }

      // Scale, tile and re-encode in the page: Chromium is already the image library at hand.
      const picture = await page.evaluate(
        async( {
          sources, maxEdge, mimeType, columns, rows
        } ) => {
          const images = await Promise.all( sources.map( async( source ) => {
            const image = new Image();

            image.src = `data:image/png;base64,${ source }`;
            await image.decode();

            return image;
          } ) );
          const cellWidth = images[ 0 ].naturalWidth;
          const cellHeight = images[ 0 ].naturalHeight;
          const gap = images.length > 1 ? Math.round( Math.max(
            cellWidth,
            cellHeight
          ) * 0.02 ) : 0;
          const fullWidth = columns * cellWidth + ( columns - 1 ) * gap;
          const fullHeight = rows * cellHeight + ( rows - 1 ) * gap;
          const scale = Math.min(
            1,
            maxEdge / Math.max(
              fullWidth,
              fullHeight
            )
          );
          const canvas = document.createElement( "canvas" );

          canvas.width = Math.max(
            1,
            Math.round( fullWidth * scale )
          );
          canvas.height = Math.max(
            1,
            Math.round( fullHeight * scale )
          );

          const ctx = canvas.getContext( "2d" )!;

          // JPEG has no alpha, and a sheet has gaps: both read against mid grey.
          if ( mimeType === "image/jpeg" || images.length > 1 ) {
            ctx.fillStyle = images.length > 1 ? "#808080" : "#fff";
            ctx.fillRect(
              0,
              0,
              canvas.width,
              canvas.height
            );
          }
          images.forEach( (
            image, i
          ) => {
            const column = i % columns;
            const row = Math.floor( i / columns );

            ctx.drawImage(
              image,
              Math.round( column * ( cellWidth + gap ) * scale ),
              Math.round( row * ( cellHeight + gap ) * scale ),
              Math.round( cellWidth * scale ),
              Math.round( cellHeight * scale )
            );
          } );

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
            sourceWidth: cellWidth,
            sourceHeight: cellHeight
          };
        },
        {
          sources: pngs,
          maxEdge: request.maxEdge,
          mimeType: request.format === "png" ? "image/png" : "image/jpeg",
          ...sheetGrid( pngs.length )
        }
      );

      return {
        mimeType: request.format === "png" ? "image/png" : "image/jpeg",
        ...picture,
        frames,
        timing,
        url: request.url,
        problems
      };
    } finally {
      await context.close().catch( () => undefined );
    }
  }
}
