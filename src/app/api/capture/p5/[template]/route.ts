import createBrowserPage from "@/utils/createBrowserPage";
import downloadFileResponse from "@/utils/downloadFileResponse";
import fs from "node:fs/promises";

const { createPage } = await createBrowserPage({
    headless: false,
    deviceScaleFactor: 1
});

function minifyAndEncodeCaptureOptions(captureOptions: Record<string, any>) {
    const jsonString = JSON.stringify(captureOptions);

    return Buffer.from(jsonString).toString('base64');
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ template: string }> }
) {
    const captureOptions = {};

    try {
        const data = await request.json();
        Object.assign(captureOptions, ...data);
    } catch (e) {}

    // return Response.json({captureOptions, encoded: minifyAndEncodeCaptureOptions(captureOptions)});
    console.log({captureOptions, encoded: minifyAndEncodeCaptureOptions(captureOptions)});

    const template = (await params).template;
    const page = await createPage();
    const url = `http://localhost:3000/p5/${template}?captureOptions=${minifyAndEncodeCaptureOptions(captureOptions)}`;

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