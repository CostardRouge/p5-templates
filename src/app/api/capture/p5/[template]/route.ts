import createBrowserPage from "@/utils/createBrowserPage";
import downloadFileResponse from "@/utils/downloadFileResponse";
import fs from "node:fs/promises";

const { createPage } = await createBrowserPage({
    headless: false
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ template: string }> }
) {
    const template = (await params).template;
    const page = await createPage();
    const url = `http://localhost:3000/p5/${template}`;

    await page.goto(url, { waitUntil: "networkidle" });

    // @ts-ignore
    await page.evaluate(() => window.startLoopRecording());

    // Wait for download
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;

    const outputPath = `./public/uploads/${(new Date()).getTime()}_${download.suggestedFilename()}`;

    await download.saveAs(outputPath);

    return downloadFileResponse(outputPath, async () => {
        await fs.unlink(outputPath);
    })
}