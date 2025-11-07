import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/jobStore";
import { getDownloadUrlFromS3Url } from "@/lib/connections/s3";

/**
 * GET /api/recordings/[id]/media
 * Returns thumbnails and video URLs with signed S3 URLs
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jobId = (await params).id;

  try {
    const job = await getJobById(jobId);

    if (!job) {
      return new NextResponse("Job not found", { status: 404 });
    }

    // Parse thumbnails and videoUrls from JSON
    const thumbnails = job.thumbnails ? (job.thumbnails as unknown as string[]) : [];
    const videoUrls = job.videoUrls ? (job.videoUrls as unknown as string[]) : [];

    // Check if this is an old recording (has resultUrl but no videoUrls)
    const isOldRecording = job.resultUrl && (!videoUrls || videoUrls.length === 0);
    
    // For old recordings with zip files, don't provide video URLs
    if (isOldRecording && job.resultUrl?.endsWith('.zip')) {
      return NextResponse.json({
        thumbnails: [],
        videos: [],
        isZipArchive: true,
        resultUrl: job.resultUrl
      });
    }

    // Generate signed URLs for thumbnails
    const thumbnailSignedUrls = await Promise.all(
      thumbnails.map(async (key) => {
        try {
          return await getDownloadUrlFromS3Url(key, 3600);
        } catch (error) {
          console.error(`Failed to generate signed URL for thumbnail ${key}:`, error);
          return null;
        }
      })
    );

    // Generate signed URLs for videos
    const videoSignedUrls = await Promise.all(
      videoUrls.map(async (key) => {
        try {
          return await getDownloadUrlFromS3Url(key, 3600);
        } catch (error) {
          console.error(`Failed to generate signed URL for video ${key}:`, error);
          return null;
        }
      })
    );

    return NextResponse.json({
      thumbnails: thumbnailSignedUrls.filter(Boolean),
      videos: videoSignedUrls.filter(Boolean),
      isZipArchive: false
    });
  } catch (error) {
    console.error(`[GET /api/recordings/${jobId}/media]`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
