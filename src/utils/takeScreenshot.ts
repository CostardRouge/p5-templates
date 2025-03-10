import { Page } from "playwright";

async function takeScreenshot({
      page,
      url,
      outputPath,
      selectorToWaitFor = "#image",
      selectorWaitForTimeout = 10_000_000,
      viewportSize = { width: 1080, height: 1350 }
}: {
    page: Page,
    url: string,
    outputPath: string,
    selectorToWaitFor?: string,
    selectorWaitForTimeout?: number,
    viewportSize?: {
        width: number,
        height: number
    }
}) {
    await page.setViewportSize(viewportSize);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(selectorToWaitFor, { timeout: selectorWaitForTimeout });
    await page.locator("body > div").screenshot({ path: outputPath });
}

export default takeScreenshot;