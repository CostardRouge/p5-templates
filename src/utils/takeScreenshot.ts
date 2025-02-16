import { Page } from "playwright";

async function takeScreenshot({
      page,
      url,
      outputPath,
      selectorToWaitFor = "#image",
      viewportSize = { width: 1080, height: 1350 }
}: {
    page: Page,
    url: string,
    outputPath: string,
    selectorToWaitFor?: string,
    viewportSize?: {
        width: number,
        height: number
    }
}) {
    await page.setViewportSize(viewportSize);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(selectorToWaitFor);
    await page.locator("body").screenshot({ path: outputPath });
}

export default takeScreenshot;