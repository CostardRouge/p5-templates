import createBrowserPage from "@/utils/createBrowserPage";

import {
  Browser, Page
} from "playwright";

import getSketchList from "@/utils/getSketchList";

import {
  ASSETS_DIRECTORY
} from "@/constants";

import fs from "node:fs/promises";
import path from "node:path";
import {
  captureCanvasBuffer, writeThumbnail
} from "@/utils/captureCanvasThumbnail";
import fileExists from "@/utils/fileExists";

const THUMBNAIL_VARIANTS = [
  {
    suffix: "",
    width: 360,
    height: 450
  },
  {
    suffix: "-2x",
    width: 720,
    height: 900
  }
] as const;
const THUMBNAIL_QUALITY = 80;

type CreateSketchThumbnailsOptions = {
  targetSketch?: {
    name: string;
    engineId: string;
  };
  overwrite?: boolean;
};

async function createSketchThumbnails( options: CreateSketchThumbnailsOptions = {} ) {
  const {
    targetSketch, overwrite = false
  } = options;
  const recordingState: {
    page?: Page;
    browser?: Browser;
  } = {
    page: undefined
  };

  try {
    const sketches = ( await getSketchList() ) ?? [];

    const filtered = targetSketch
      ? sketches.filter( ( s ) => s.name === targetSketch.name && s.engine === targetSketch.engineId )
      : sketches;

    const templates = filtered.map( ( {
      name, engine, category
    } ) => ( {
      href: category ? `templates/${ engine }/${ category }/${ name }` : `templates/${ engine }/${ name }`,
      name,
      engine
    } ) );

    const {
      createPage, browser
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );

    recordingState.browser = browser;
    recordingState.page = await createPage();

    for ( const {
      href, name, engine
    } of templates ) {
      const thumbnailDir = `${ ASSETS_DIRECTORY }/images/templates/${ engine }/${ name }`;
      const variantPaths = THUMBNAIL_VARIANTS.map( ( v ) => `${ thumbnailDir }/thumbnail${ v.suffix }.webp` );

      if ( !overwrite ) {
        const existing = await Promise.all( variantPaths.map( fileExists ) );

        if ( existing.every( Boolean ) ) {
          console.log( `✅ ${ name } thumbnails already exist!` );
          continue;
        }
      }

      await recordingState.page.goto(
        `http://localhost:3000/${ href }?capturing`,
        {
          waitUntil: "networkidle"
        }
      );

      // Capture once, encode each size with high-quality lanczos3 interpolation
      const buffer = await captureCanvasBuffer( recordingState.page );

      for ( const {
        suffix, width, height
      } of THUMBNAIL_VARIANTS ) {
        await writeThumbnail(
          buffer,
          `${ thumbnailDir }/thumbnail${ suffix }.webp`,
          {
            format: "webp",
            quality: THUMBNAIL_QUALITY,
            resize: {
              width,
              height,
              fit: "cover"
            }
          }
        );
      }

      // Mark hasThumbnail: true in metadata.json
      const metadataPath = path.join(
        process.cwd(),
        "src/templates/metadata.json"
      );
      const raw = await fs.readFile(
        metadataPath,
        "utf-8"
      );
      const entries = JSON.parse( raw ) as Array<Record<string, unknown>>;
      const entry = entries.find( ( e ) => e.name === name );

      if ( entry ) {
        entry.hasThumbnail = true;
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

      console.log( `💾 ${ name } webp thumbnails generated (1x + 2x)` );
    }
  } catch( error ) {
    console.error( error );
  } finally {
    await recordingState?.browser?.close();
  }
}

export default createSketchThumbnails;
