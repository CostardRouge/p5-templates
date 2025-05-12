import {
  chromium
} from "playwright";

async function createBrowserPage( {
  initialPage = false,
  headless = true,
  deviceScaleFactor = 2,
  timeout = 3000000
} = {
} ) {
  const browser = await chromium.launch( {
    headless,
    timeout
  } );
  const createPage = async( {
    viewportSize = {
      width: 1080,
      height: 1350
    }
  } = {
  } ) => {
    const page = await browser.newPage( {
      deviceScaleFactor
    } );

    await page.setViewportSize( viewportSize );

    return page;
  };
  const page = initialPage ? await createPage() : undefined;

  return {
    createPage,
    browser,
    page,
  };
}

export default createBrowserPage;