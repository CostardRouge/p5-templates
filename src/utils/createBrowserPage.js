import { chromium } from "playwright";

async function createBrowserPage({
    headless = true,
    deviceScaleFactor = 2,
} = {}) {
    const browser = await chromium.launch({ headless });
    const page = await browser.newPage({ deviceScaleFactor });

    return { browser, page };
}

export default createBrowserPage;