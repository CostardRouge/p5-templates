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

// Preview capture + output. We pass previewFramerate + previewDuration as URL
// params so the sketch itself is told to run its full animation within this
// window (see page.tsx — it overrides sketchOptions.animation when these are
// present). time.js then advances its clock at 1000/PREVIEW_FPS ms per captured
// frame and getAnimationProgression() divides elapsed time by PREVIEW_SECS, so
// one full loop fits into the captured frame budget regardless of the sketch's
// native duration.
const PREVIEW_FPS = 20;
const PREVIEW_SECS = 9;
const TOTAL_FRAMES = PREVIEW_FPS * PREVIEW_SECS;
const PREVIEW_SIZE = {
  width: 360,
  height: 450
};

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
        width: 1080,
        height: 1350
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

      console.log( `🎬 ${ name } — capturing ${ TOTAL_FRAMES } frames` +
        ` (${ PREVIEW_FPS }fps × ${ PREVIEW_SECS }s, full loop)` );

      const tmpDir = await fs.mkdtemp( path.join(
        os.tmpdir(),
        `preview-${ name }-`
      ) );

      try {
        await state.page.goto(
          `http://localhost:3000/${ href }?capturing&previewFramerate=${ PREVIEW_FPS }&previewDuration=${ PREVIEW_SECS }`,
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
          totalFrames: TOTAL_FRAMES
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
          PREVIEW_SECS,
          PREVIEW_FPS,
          PREVIEW_SIZE
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
