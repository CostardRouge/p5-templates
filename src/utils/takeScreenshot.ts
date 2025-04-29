import { Page } from "playwright";

async function takeScreenshot({
      page,
      url,
      outputPath,
      selectorToWaitFor = "#image",
      selectorToCapture = "#div-to-capture",
      selectorWaitForTimeout = 10_000_000,
      viewportSize = { width: 1080, height: 1350 }
}: {
    page: Page,
    url: string,
    outputPath: string,
    selectorToWaitFor?: string,
    selectorToCapture?: string,
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
    await page.locator(selectorToCapture).screenshot({ path: outputPath });
}

export default takeScreenshot;