import createBrowserPage from "@/utils/createBrowserPage";
import getSketchList from "@/utils/getSketchList";
import {
  captureFramesServerSide
} from "@/utils/captureFramesServerSide";
import encodePreviewFromFrames from "@/lib/encodePreviewFromFrames";
import {
  ASSETS_DIRECTORY
} from "@/constants";
import fileExists from "@/utils/fileExists";

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  Browser, Page
} from "playwright";

// Preview capture + output: fixed rate so the full animation loop fits in 3 s.
// 20 fps × 3 s = 60 frames — enough for most sketch loops to complete one full cycle.
const PREVIEW_TARGET_SECS = 3;
const PREVIEW_OUTPUT_FPS = 20;

const CAPTURE_FPS = PREVIEW_OUTPUT_FPS;
const CAPTURE_DURATION_SECS = PREVIEW_TARGET_SECS;

async function createSketchPreviews() {
  const state: { browser?: Browser;
    page?: Page } = {};

  try {
    const sketches = ( await getSketchList() ) ?? [];

    const templates = sketches.map( ( {
      name, engine, category
    } ) => ( {
      href: category
        ? `templates/${ engine }/${ category }/${ name }`
        : `templates/${ engine }/${ name }`,
      name,
      engine
    } ) );

    const {
      browser, createPage
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );

    state.browser = browser;
    state.page = await createPage( {
      viewportSize: {
        width: 360,
        height: 450
      }
    } );

    const metadataPath = path.join(
      process.cwd(),
      "src/templates/metadata.json"
    );

    for ( const {
      href, name, engine
    } of templates ) {
      const previewPath = `${ ASSETS_DIRECTORY }/images/templates/${ engine }/${ name }/preview.webm`;

      if ( await fileExists( previewPath ) ) {
        console.log( `✅ ${ name }/preview.webm already exists` );
        continue;
      }

      const totalFrames = Math.round( CAPTURE_FPS * CAPTURE_DURATION_SECS );

      console.log( `🎬 ${ name } — capturing ${ totalFrames } frames` +
        ` (${ CAPTURE_FPS }fps × ${ CAPTURE_DURATION_SECS }s preview)` );

      const tmpDir = await fs.mkdtemp( path.join(
        os.tmpdir(),
        `preview-${ name }-`
      ) );

      try {
        await state.page.goto(
          `http://localhost:3000/${ href }?capturing`,
          {
            waitUntil: "networkidle"
          }
        );

        await state.page.waitForSelector(
          "[data-engine-ready], canvas.p5Canvas.loaded",
          {
            timeout: 30000
          }
        );

        await captureFramesServerSide( {
          page: state.page,
          framesDirectory: tmpDir,
          totalFrames
        } );

        await fs.mkdir(
          path.dirname( previewPath ),
          {
            recursive: true
          }
        );

        await encodePreviewFromFrames(
          tmpDir,
          previewPath,
          PREVIEW_TARGET_SECS,
          PREVIEW_OUTPUT_FPS
        );

        const raw = await fs.readFile(
          metadataPath,
          "utf-8"
        );
        const entries = JSON.parse( raw ) as Array<Record<string, unknown>>;
        const entry = entries.find( ( e ) => e.name === name );

        if ( entry ) {
          entry.hasPreview = true;
          await fs.writeFile(
            metadataPath,
            JSON.stringify(
              entries,
              null,
              2
            ),
            "utf-8"
          );
        }

        console.log( `💾 ${ name }/preview.webm generated` );
      } finally {
        await fs.rm(
          tmpDir,
          {
            recursive: true,
            force: true
          }
        ).catch( () => {} );
      }
    }
  } catch( err ) {
    console.error( err );
  } finally {
    await state.browser?.close();
  }
}

export default createSketchPreviews;
