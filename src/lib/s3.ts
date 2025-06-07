/* --------------------------------------------------------------------------
   lib/s3.ts
   --------------------------------------------------------------------------
   S3 client and helper functions for uploading and downloading artifacts.
   Supports AWS S3 or any S3-compatible endpoint (e.g. MinIO).
   -------------------------------------------------------------------------- */

import {
  S3Client, PutObjectCommand, GetObjectCommand, ObjectCannedACL
} from "@aws-sdk/client-s3";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "path";
import {
  pipeline
} from "stream";
import {
  promisify
} from "util";

const streamPipeline = promisify( pipeline );

// ─── 1. Initialize S3Client ──────────────────────────────────────────────────
const s3 = new S3Client( {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // required for MinIO; safe for AWS
} );

/**
 * uploadArtifact:
 *  - localPath: absolute path to a local file
 *  - returns: public URL (constructed from S3_CDN and the stored key)
 */
export async function uploadArtifact(
  jobId: string,
  localPath: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET!;
  const baseName = path.basename( localPath );
  const s3Key = `jobs/${ jobId }/${ baseName }`;

  const fileStream = fs.createReadStream( localPath );

  const putParams = {
    Bucket: bucketName,
    Key: s3Key,
    Body: fileStream,
    ACL: ObjectCannedACL.public_read, // adjust if your bucket is private
  };

  await s3.send( new PutObjectCommand( putParams ) );

  // Construct the public URL based on your S3_CDN environment variable
  const cdnBase = process.env.S3_CDN!;

  return `${ cdnBase }/jobs/${ jobId }/${ baseName }`;
}

/**
 * downloadAsset:
 *  - s3Url: full public URL (or presigned URL) to an object in S3
 *  - destinationPath: local file path to write into
 */
export async function downloadAsset(
  s3Url: string,
  destinationPath: string
): Promise<void> {
  // Extract bucket and key from s3Url
  // Example s3Url: "https://mycdn.example.com/jobs/12345/image.png"
  const url = new URL( s3Url );
  const bucketName = process.env.S3_BUCKET!;
  // Assumes s3Url path format: /{...}/jobs/{jobId}/{filename}
  const key = url.pathname.replace(
    /^\/+/,
    ""
  ); // remove leading slash if present

  // Send GetObject to S3
  const getParams = {
    Bucket: bucketName,
    Key: key,
  };

  const getCommand = new GetObjectCommand( getParams );
  const response = await s3.send( getCommand );

  // Ensure the directory exists
  await fsPromises.mkdir(
    path.dirname( destinationPath ),
    {
      recursive: true
    }
  );

  // Stream the S3 object to the local file
  const bodyStream = response.Body as NodeJS.ReadableStream;

  await streamPipeline(
    bodyStream,
    fs.createWriteStream( destinationPath )
  );
}
