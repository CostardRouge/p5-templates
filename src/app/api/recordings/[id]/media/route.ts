import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/jobStore";
import { getDownloadUrlFromS3Url, getObjectSize } from "@/lib/connections/s3";

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
    const videoSizes = job.videoSizes ? (job.videoSizes as unknown as number[]) : [];

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

    // Generate signed URLs for videos and use sizes from DB
    const videoData = await Promise.all(
      videoUrls.map(async (key, index) => {
        try {
          const url = await getDownloadUrlFromS3Url(key, 3600);
          // Use size from DB if available, otherwise fetch from S3
          let size = videoSizes[index];
          if (!size) {
            size = await getObjectSize(key);
          }
          return {
            url,
            size,
            index,
            key
          };
        } catch (error) {
          console.error(`Failed to generate signed URL for video ${key}:`, error);
          return null;
        }
      })
    );

    // Calculate estimated zip size by summing all video sizes
    // Zip with no compression (store only) has minimal overhead (~22 bytes per file + central directory)
    let zipSize: number | null = null;
    const validVideos = videoData.filter((v): v is NonNullable<typeof v> => v !== null);
    if (validVideos.length > 0) {
      const totalVideoSize = validVideos.reduce((sum, video) => sum + (video.size || 0), 0);
      // Add small overhead for zip structure (roughly 100 bytes per file + 1KB for headers)
      zipSize = totalVideoSize + (validVideos.length * 100) + 1024;
    }

    return NextResponse.json({
      thumbnails: thumbnailSignedUrls.filter(Boolean),
      videos: videoData.filter(Boolean),
      zipSize,
      recordingDuration: job.recordingDuration,
      isZipArchive: false
    });
  } catch (error) {
    console.error(`[GET /api/recordings/${jobId}/media]`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
