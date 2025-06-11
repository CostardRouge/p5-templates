import createBrowserPage from "@/utils/createBrowserPage";

import {
  Browser,
  Page
} from "playwright";
import getSketchList from "@/utils/getSketchList";

const canvasSelectorToScreenShoot = "canvas#defaultCanvas0.loaded";

async function recordSketch(
  template: string,
  captureOptions: any,
) {
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
      console.log( href );

      await recordingState.page.goto(
        `http://localhost:3000/${ href }`,
        {
          waitUntil: "networkidle"
        },
      );

      await recordingState.page.waitForSelector( canvasSelectorToScreenShoot );
      await recordingState.page
        .locator( canvasSelectorToScreenShoot )
        .screenshot( {
          path: ""
        } );
    }
  }
  catch ( error ) {
    console.error( error );
  }
  finally {
    await recordingState?.browser?.close();
  }
}

export default recordSketch;