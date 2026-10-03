import {
  GetObjectCommand,
  HeadObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from "@aws-sdk/client-s3";

import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";

import {
  isSafeJobId
} from "@/lib/recordingInput";

// Main S3 client for operations (uses internal endpoint for server-side operations)
const s3client = new S3Client( {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  },
  forcePathStyle: true
} );

// Public S3 client for generating signed URLs (uses public endpoint for browser access)
const s3clientPublic = new S3Client( {
  endpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  },
  forcePathStyle: true
} );

export async function uploadArtifact(
  objectKey: string,
  fileStream: Buffer,
  contentType?: string
): Promise<string> {
  await s3client.send( new PutObjectCommand( {
    Bucket: process.env.S3_BUCKET!,
    Key: objectKey,
    Body: fileStream,
    ACL: ObjectCannedACL.public_read,
    ...( contentType ? {
      ContentType: contentType
    } : {} )
  } ) );

  return objectKey;
}

export async function getDownloadUrlFromS3Url(
  objectKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  // Use public client to generate signed URLs with the correct public endpoint
  const signedUrl = await getSignedUrl(
    s3clientPublic,
    new GetObjectCommand( {
      Bucket: process.env.S3_BUCKET!,
      Key: objectKey
    } ),
    {
      expiresIn: expiresInSeconds
    }
  );

  return signedUrl;
}

export type S3ObjectStream = {
  body: ReadableStream | null;
  /** 206 when S3 answered a byte-range request, 200 otherwise. */
  status: 200 | 206;
  headers: Record<string, string>;
};

/**
 * Open a streaming read of an S3 object, optionally limited to a byte range
 * (the raw `Range` request header value, e.g. `bytes=0-1`).
 *
 * Range support is what lets media elements progressively fetch and seek:
 * WebKit (iOS Safari) refuses to play a `<video>` whose server cannot answer
 * `Range` requests with `206 Partial Content`.
 */
export async function getObjectStream(
  objectKey: string,
  range?: string | null
): Promise<S3ObjectStream> {
  const response = await s3client.send( new GetObjectCommand( {
    Bucket: process.env.S3_BUCKET!,
    Key: objectKey,
    ...( range ? {
      Range: range
    } : {} )
  } ) );

  const headers: Record<string, string> = {
    "accept-ranges": "bytes"
  };

  if ( response.ContentType ) {
    headers[ "content-type" ] = response.ContentType;
  }

  if ( typeof response.ContentLength === "number" ) {
    headers[ "content-length" ] = String( response.ContentLength );
  }

  if ( response.ContentRange ) {
    headers[ "content-range" ] = response.ContentRange;
  }

  if ( response.ETag ) {
    headers.etag = response.ETag;
  }

  if ( response.LastModified ) {
    headers[ "last-modified" ] = response.LastModified.toUTCString();
  }

  const body = response.Body
    ? ( response.Body as unknown as {
      transformToWebStream: () => ReadableStream;
    } ).transformToWebStream()
    : null;

  return {
    body,
    status: response.ContentRange ? 206 : 200,
    headers
  };
}

/**
 * Download an object from S3 and return its contents as a Node.js Buffer.
 *
 * @param objectKey  the key of the object in your bucket
 * @returns          a Buffer containing the object’s bytes
 */
export async function getBufferFromS3Url( objectKey: string ): Promise<Buffer> {
  // 1) Fetch the object
  const response = await s3client.send( new GetObjectCommand( {
    Bucket: process.env.S3_BUCKET!,
    Key: objectKey
  } ) );

  // 2) response.Body is a Readable stream—accumulate into chunks
  const stream = response.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];

  for await ( const chunk of stream ) {
    // chunk can be string or Buffer; normalize to Buffer
    chunks.push( typeof chunk === "string" ? Buffer.from( chunk ) : chunk );
  }

  // 3) concatenate and return
  return Buffer.concat( chunks );
}

/**
 * Get the size of an object in S3 in bytes
 * @param objectKey the key of the object in your bucket
 * @returns the size in bytes, or null if not found
 */
export async function getObjectSize( objectKey: string ): Promise<number | null> {
  try {
    const response = await s3client.send( new HeadObjectCommand( {
      Bucket: process.env.S3_BUCKET!,
      Key: objectKey
    } ) );

    return response.ContentLength ?? null;
  } catch( error ) {
    console.error(
      `Failed to get object size for ${ objectKey }:`,
      error
    );
    return null;
  }
}

/**
 * Delete everything a recording job owns: every object under `<jobId>/`, plus
 * `extraKeys` (the job's server-written `resultUrl`, so a legacy archive
 * stored outside that folder is not orphaned).
 *
 * The listing is scoped to the folder, trailing slash included. The previous
 * bare-`jobId` prefix also matched every key that merely starts with it: a job
 * named `1` took every recording whose id begins with 1, and a job named `""`
 * (which the enqueue route used to accept) listed the whole bucket.
 */
export async function deleteJobArtifacts(
  jobId: string,
  extraKeys: string[] = []
): Promise<void> {
  if ( !isSafeJobId( jobId ) ) {
    throw new Error( `Refusing to delete artifacts for unsafe job id ${ JSON.stringify( jobId ) }` );
  }

  const bucketName = process.env.S3_BUCKET!;
  const keys = new Set<string>( extraKeys );
  let continuationToken: string | undefined;

  do {
    const listed = await s3client.send( new ListObjectsV2Command( {
      Bucket: bucketName,
      Prefix: `${ jobId }/`,
      ContinuationToken: continuationToken
    } ) );

    for ( const item of listed.Contents ?? [] ) {
      if ( item.Key ) {
        keys.add( item.Key );
      }
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while ( continuationToken );

  const allKeys = [
    ...keys
  ];

  // DeleteObjects takes at most 1000 keys per request.
  for ( let start = 0; start < allKeys.length; start += 1000 ) {
    await s3client.send( new DeleteObjectsCommand( {
      Bucket: bucketName,
      Delete: {
        Objects: allKeys.slice(
          start,
          start + 1000
        ).map( ( Key ) => ( {
          Key
        } ) ),
        Quiet: true
      }
    } ) );
  }
}
