import { chromium } from "playwright";

async function createBrowserPage({
    initialPage = false,
    headless = true,
    deviceScaleFactor = 2,
} = {}) {
    const browser = await chromium.launch({ headless });
    const createPage = async ({
          viewportSize = { width: 1080, height: 1350 }
      } = {}) => {
        const page = await browser.newPage({ deviceScaleFactor });

        await page.setViewportSize(viewportSize);

        return page;
    };
    const page = initialPage ? createPage() : undefined;

    return {
        createPage,
        browser,
        page,
    };
}

export default createBrowserPage;