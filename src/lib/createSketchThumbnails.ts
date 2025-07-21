import createBrowserPage from "@/utils/createBrowserPage";

import {
  Browser,
  Page
} from "playwright";

import getSketchList from "@/utils/getSketchList";

import {
  SKETCHES_DIRECTORY
} from "@/constants";

import fs from "node:fs/promises";
import sleep from "@/utils/sleep";

const canvasSelectorToScreenShot = "canvas#defaultCanvas0.loaded";

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
    page?: Page,
    browser?: Browser,
  } = {
    page: undefined
  };

  try {
    const p5sketches = await getSketchList();
    const p5sketchNames = p5sketches
      .map( ( file ) => ( {
        href: `templates/p5/${ file }`,
        name: file
      } ) );

    const {
      createPage,
      browser
    } = await createBrowserPage( {
      headless: true,
      deviceScaleFactor: 1
    } );

    recordingState.browser = browser;
    recordingState.page = await createPage();

    for ( const {
      href, name
    } of p5sketchNames ) {
      const thumbnailPath = `${ SKETCHES_DIRECTORY }/${ name }/thumbnail.jpeg`;

      if ( await exists( thumbnailPath ) ) {
        console.log( `✅ ${ name }/thumbnail.jpeg already exists!` );
        continue;
      }

      await recordingState.page.goto(
        `http://localhost:3000/${ href }`,
        {
          waitUntil: "networkidle"
        },
      );

      await recordingState.page.waitForSelector( canvasSelectorToScreenShot );

      await recordingState.page.locator( canvasSelectorToScreenShot )
        .evaluate( ( element ) => {
          element.style.width = "360px";
          element.style.height = "450px";
        } );

      await recordingState.page
        .locator( canvasSelectorToScreenShot )
        .screenshot( {
          path: thumbnailPath
        } );
      console.log( `💾 ${ name }/thumbnail.jpeg has been generated` );
    }
  }
  catch ( error ) {
    console.error( error );
  }
  finally {
    await recordingState?.browser?.close();
  }
}

export default createSketchThumbnails;