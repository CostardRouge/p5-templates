import createBrowserPage from "@/utils/createBrowserPage";
import getSketchList from "@/utils/getSketchList";
import {
  captureFramesServerSide
} from "@/utils/captureFramesServerSide";
import encodePreviewFromFrames from "@/lib/encodePreviewFromFrames";
import {
  getJSONSketchOptions
} from "@/utils/getSketchOptions";
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

// Output video: 3 s at 20 fps. All captured frames are spread evenly into this window.
const PREVIEW_TARGET_SECS = 3;
const PREVIEW_OUTPUT_FPS = 20;

// Cap capture at this many seconds of animation to avoid recording overly long loops.
const CAPTURE_MAX_SECS = 3;

// Fallbacks for sketches without options.json
const DEFAULT_SKETCH_FPS = 60;
const DEFAULT_SKETCH_DURATION = 3;

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

      // Read the sketch's own framerate and duration so time.js advances correctly.
      // time.js uses animation.framerate (not our capture rate) to step elapsed time,
      // so we must capture framerate × duration frames to cover one full loop.
      // Cap at CAPTURE_MAX_SECS to keep capture times reasonable.
      const jsonOptions = await getJSONSketchOptions( name, engine );
      const sketchFps = ( jsonOptions?.animation as any )?.framerate ?? DEFAULT_SKETCH_FPS;
      const sketchDuration = ( jsonOptions?.animation as any )?.duration ?? DEFAULT_SKETCH_DURATION;
      const captureSecs = Math.min( sketchDuration, CAPTURE_MAX_SECS );
      const totalFrames = Math.round( sketchFps * captureSecs );

      console.log( `🎬 ${ name } — capturing ${ totalFrames } frames` +
        ` (${ sketchFps }fps × ${ captureSecs }s → ${ PREVIEW_TARGET_SECS }s preview)` );

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
