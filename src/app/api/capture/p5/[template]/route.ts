import createBrowserPage from "@/utils/createBrowserPage";
import downloadFileResponse from "@/utils/downloadFileResponse";
import fs from "node:fs/promises";
import path from 'path';
import * as tar from 'tar';
import { spawn } from 'child_process';

const { createPage } = await createBrowserPage({
    headless: true,
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
    const tempDir = path.join(process.cwd(), 'public', 'uploads', `temp_${Date.now()}`);

    try {
        const data = await request.json();
        Object.assign(captureOptions, ...data);

        // return Response.json({captureOptions, encoded: minifyAndEncodeCaptureOptions(captureOptions)});
        // console.log({captureOptions, encoded: minifyAndEncodeCaptureOptions(captureOptions)});

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

        // Create temporary directory
        await fs.mkdir(tempDir, { recursive: true });

        // Extract tar file
        await tar.x({
            file: outputPath,
            cwd: tempDir
        });

        // Generate video from frames
        const videoPath = path.join(process.cwd(), 'public', 'uploads', `${Date.now()}_output.mp4`);

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-framerate', '60',
                '-pattern_type', 'glob',
                '-i', '*.png',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'fast',
                '-crf', '23',
                '-y',
                videoPath
            ], {
                cwd: tempDir
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) reject(new Error(`FFmpeg exited with code ${code}`));
                else resolve(true);
            });

            ffmpeg.on('error', reject);
        });

        // Cleanup temporary files
        await Promise.all([
            fs.rm(tempDir, { recursive: true, force: true }),
            fs.unlink(outputPath)
        ]);

        return downloadFileResponse(videoPath, async () => {
            await fs.unlink(videoPath);
        });
    } catch (error) {
        // Cleanup on error
        await Promise.all([
            fs.rm(tempDir, { recursive: true, force: true }).catch(() => {}),
            // fs.unlink(outputPath).catch(() => {})
        ]);

        console.error('Processing error:', error);
        return new Response('Video processing failed', { status: 500 });
    }
}