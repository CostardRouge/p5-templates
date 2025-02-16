import { chromium } from "playwright";

async function createBrowserPage({
    initialPage = false,
    headless = true,
    deviceScaleFactor = 2,
} = {}) {
    const browser = await chromium.launch({ headless });
    const createPage = async () => await browser.newPage({ deviceScaleFactor });
    const page = initialPage ? createPage() : undefined;

    return {
        createPage,
        browser,
        page,
    };
}

export default createBrowserPage;