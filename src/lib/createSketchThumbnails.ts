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
import fileExists from "@/utils/fileExists";

async function createSketchThumbnails() {
  const recordingState: {
    page?: Page;
    browser?: Browser;
  } = {
    page: undefined
  };

  try {
    const sketches = ( await getSketchList() ) ?? [];

    const templates = sketches.map( ( {
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
      const thumbnailPath = `${ ASSETS_DIRECTORY }/images/templates/${ engine }/${ name }/thumbnail.jpeg`;

      if ( await fileExists( thumbnailPath ) ) {
        console.log( `✅ ${ name }/thumbnail.jpeg already exists!` );
        continue;
      }

      await recordingState.page.goto(
        `http://localhost:3000/${ href }?capturing`,
        {
          waitUntil: "networkidle"
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
            fit: "cover"
          },
          quality: 90,
          format: "jpeg"
        }
      );

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

      console.log( `💾 ${ name }/thumbnail.jpeg has been generated` );
    }
  } catch( error ) {
    console.error( error );
  } finally {
    await recordingState?.browser?.close();
  }
}

export default createSketchThumbnails;
