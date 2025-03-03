import createBrowserPage from "@/utils/createBrowserPage";
import downloadFileResponse from "@/utils/downloadFileResponse";
import fs from "node:fs/promises";
import path from 'path';
// import * as tar from 'tar';
import { spawn } from 'child_process';

const { createPage, browser } = await createBrowserPage({
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
    const captureOptions =  {
        size: {
            width: 512,
            height: 512
        },
        animation: {
            framerate: 30,
            duration: 1
        },
        texts: {
            top: "top",
            bottom: "bottom"
        },
        colors: {
            text: [0,0,0],
            background: [230, 230, 230]
        }
    };

    const tempDir = path.join(process.cwd(), 'public', 'uploads', `temp_${Date.now()}`);

    // Create temporary directory
    await fs.mkdir(tempDir, { recursive: true });

    console.log(tempDir)

    try {
        const data = await request.json();

        Object.assign(captureOptions, ...data);

        // return Response.json({captureOptions, encoded: minifyAndEncodeCaptureOptions(captureOptions)});
        // console.log({captureOptions, encoded: minifyAndEncodeCaptureOptions(captureOptions)});

        const template = (await params).template;
        const page = await createPage();
        const url = `http://localhost:3000/p5/${template}?captureOptions=${minifyAndEncodeCaptureOptions(captureOptions)}`;

        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForSelector("canvas#defaultCanvas0");

        // @ts-ignore
        await page.evaluate(() => window.startLoopRecording());

        // Wait for download
        const download = await page.waitForEvent('download', {
            timeout: 30_000
        });
        const outputPath = path.join(tempDir, download.suggestedFilename());

        await download.saveAs(outputPath);
        await page.close()

        // Generate video from frames
        const videoPath = path.join(tempDir, "output.mp4");

        const ffmpegOptions = [
            '-r', String(captureOptions.animation.framerate),
            '-i', outputPath,
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            '-crf', '23',
            '-y',
            videoPath
        ]

        console.log({outputPath, videoPath, ffmpegOptions})

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ffmpegOptions, {
                cwd: tempDir
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) reject(new Error(`FFmpeg exited with code ${code}`));
                else resolve(true);
            });

            ffmpeg.on('error', reject);
        });

        return downloadFileResponse(videoPath, async () => {
            // Cleanup temporary files
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        });
    } catch (error) {
        // Cleanup temporary files on error
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

        console.error('Processing error:', error);
        return new Response('Video processing failed', { status: 500 });
    }
}