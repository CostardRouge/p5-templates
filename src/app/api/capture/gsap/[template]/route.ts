import {
  NextRequest
} from "next/server";
import createBrowserPage from "@/utils/createBrowserPage";
import downloadFileResponse from "@/utils/downloadFileResponse";
import {
  TemplateValidationError, validateTemplateOptions,
} from "@/lib/gsap/validation";
import fs from "node:fs/promises";
import path from "path";
import os from "node:os";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";

const execAsync = promisify( exec );

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      template: string;
    }>;
  }
) {
  const {
    template
  } = await params;

  try {
    const body = await request.json();

    const {
      options,
      outputFormat = "video",
      contentDisposition = "attachment",
    } = body;

    // Validate options
    try {
      validateTemplateOptions( options );
    } catch ( error ) {
      if ( error instanceof TemplateValidationError ) {
        return Response.json(
          {
            error: error.message,
          },
          {
            status: 400,
          }
        );
      }
      throw error;
    }

    const {
      duration, framerate
    } = options.animation;
    const totalFrames = Math.ceil( duration * framerate );

    // Create temp directory for frames
    const timestamp = Date.now();
    const tmpDir = os.tmpdir();
    const framesDir = path.join(
      tmpDir,
      `gsap_${ template }_${ timestamp }`
    );

    await fs.mkdir(
      framesDir,
      {
        recursive: true,
      }
    );

    const {
      createPage, browser
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 2,
    } );

    const page = await createPage();

    try {
      // Navigate to template with options
      const url = new URL( `http://localhost:3000/gsap/${ template }` );

      url.searchParams.set(
        "capturing",
        "true"
      );
      url.searchParams.set(
        "options",
        JSON.stringify( options )
      );

      await page.goto(
        url.toString(),
        {
          waitUntil: "networkidle",
        }
      );

      // Wait for template to be ready
      await page.waitForSelector(
        "[data-ready=\"true\"]",
        {
          timeout: 30000,
        }
      );

      // Give extra time for assets to load
      await page.waitForTimeout( 1000 );

      // Capture frames
      for ( let frame = 0; frame < totalFrames; frame++ ) {
        // Seek timeline to frame
        await page.evaluate(
          ( frameNum ) => {
            window.dispatchEvent( new CustomEvent(
              "capture:seek-frame",
              {
                detail: {
                  frame: frameNum,
                },
              }
            ) );
          },
          frame
        );

        // Wait for animations to settle
        await page.waitForTimeout( 50 );

        // Capture frame
        const framePath = path.join(
          framesDir,
          `frame_${ String( frame ).padStart(
            5,
            "0"
          ) }.png`
        );

        await page.screenshot( {
          path: framePath,
          type: "png",
        } );
      }

      await page.close();
      await browser.close();

      // Generate video from frames using ffmpeg
      const outputFilename = `${ template }_${ timestamp }.mp4`;
      const outputPath = path.join(
        tmpDir,
        outputFilename
      );

      await execAsync( `ffmpeg -framerate ${ framerate } -i ${ framesDir }/frame_%05d.png -c:v libx264 -pix_fmt yuv420p -y ${ outputPath }` );

      // Return video file
      return downloadFileResponse( {
        filePath: outputPath,
        contentDisposition,
        onFileRead: async() => {
          // Cleanup
          await fs.rm(
            framesDir,
            {
              recursive: true,
              force: true,
            }
          );
          await fs.unlink( outputPath ).catch( () => {} );
        },
      } );
    } catch ( error ) {
      await page.close().catch( () => {} );
      await browser.close().catch( () => {} );
      await fs
        .rm(
          framesDir,
          {
            recursive: true,
            force: true,
          }
        )
        .catch( () => {} );

      console.error(
        "Capture error:",
        error
      );
      return Response.json(
        {
          error: error instanceof Error ? error.message : "Capture failed",
        },
        {
          status: 500,
        }
      );
    }
  } catch ( error ) {
    console.error(
      "Request error:",
      error
    );
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      {
        status: 400,
      }
    );
  }
}
