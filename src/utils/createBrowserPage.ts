import {
  chromium
} from "playwright";

async function createBrowserPage( {
  headless = true,
  deviceScaleFactor = 2,
  timeout = 3000000
} = {} ) {
  const browser = await chromium.launch( {
    headless,
    timeout,
    // Software-WebGL flags: the container has no GPU passthrough, and
    // Chromium no longer falls back to SwiftShader automatically for
    // security reasons, so a WebGL context (Three.js templates) would
    // otherwise fail to create even though 2D-canvas templates (p5) never
    // touch the GPU and are unaffected.
    args: [
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--ignore-gpu-blocklist"
    ]
  } );
  const createPage = async( {
    viewportSize = {
      width: 1080,
      height: 1350
    }
  } = {} ) => {
    const page = await browser.newPage( {
      deviceScaleFactor
    } );

    await page.setViewportSize( viewportSize );

    return page;
  };

  const page = await createPage();

  return {
    createPage,
    browser,
    page
  };
}

export default createBrowserPage;
