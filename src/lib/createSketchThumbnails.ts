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
  captureCanvasThumbnail
} from "@/utils/captureCanvasThumbnail";

async function exists( filePath: string ) {
  try {
    await fs.stat( filePath );
    return true;
  } catch {
    return false;
  }
}

async function createSketchThumbnails() {
  const recordingState: {
    page?: Page;
    browser?: Browser;
  } = {
    page: undefined,
  };

  try {
    const p5sketches = ( await getSketchList() ) ?? [
    ];

    const p5sketchNames = p5sketches.map( ( {
      name
    } ) => ( {
      href: `p5/${ name }`,
      name,
    } ) );

    const {
      createPage, browser
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1,
    } );

    recordingState.browser = browser;
    recordingState.page = await createPage();

    for ( const {
      href, name
    } of p5sketchNames ) {
      const thumbnailPath = `${ ASSETS_DIRECTORY }/images/templates/p5/${ name }/thumbnail.jpeg`;

      if ( await exists( thumbnailPath ) ) {
        console.log( `✅ ${ name }/thumbnail.jpeg already exists!` );
        continue;
      }

      await recordingState.page.goto(
        `http://localhost:3000/${ href }?capturing`,
        {
          waitUntil: "networkidle",
        }
      );

      // Capture and resize thumbnail with high-quality interpolation
      await captureCanvasThumbnail(
        recordingState.page,
        thumbnailPath,
        {
          resize: {
            width: 360,
            height: 450,
            fit: "cover",
          },
          quality: 90,
          format: "jpeg",
        }
      );

      // Mark hasThumbnail: true in metadata.json
      const metadataPath = path.join(
        process.cwd(),
        "src/p5-sketches/sketches/metadata.json"
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

      console.log( `💾 ${ name }/thumbnail.jpeg has been generated` );
    }
  } catch ( error ) {
    console.error( error );
  } finally {
    await recordingState?.browser?.close();
  }
}

export default createSketchThumbnails;
