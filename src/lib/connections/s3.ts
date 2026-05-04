import {
  GetObjectCommand,
  HeadObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from "@aws-sdk/client-s3";

import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";

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
  fileStream: Buffer
): Promise<string> {
  await s3client.send( new PutObjectCommand( {
    Bucket: process.env.S3_BUCKET!,
    Key: objectKey,
    Body: fileStream,
    ACL: ObjectCannedACL.public_read
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
  } catch ( error ) {
    console.error(
      `Failed to get object size for ${ objectKey }:`,
      error
    );
    return null;
  }
}

export async function deleteArtifact( objectKeyOrPrefix: string ): Promise<void> {
  try {
    const bucketName = process.env.S3_BUCKET!;

    // 1. Check if it's a folder (ends with slash or acts as prefix)
    let listedObjects;

    try {
      listedObjects = await s3client.send( new ListObjectsV2Command( {
        Bucket: bucketName,
        Prefix: objectKeyOrPrefix
      } ) );
    } catch ( err ) {
      console.error(
        `Failed to list objects with prefix ${ objectKeyOrPrefix }:`,
        err
      );
      throw err;
    }

    if ( listedObjects.Contents && listedObjects.Contents.length > 1 ) {
      // Multiple objects = treat as folder (prefix)
      try {
        const deleteCommand = new DeleteObjectsCommand( {
          Bucket: bucketName,
          Delete: {
            Objects: listedObjects.Contents.map( ( item ) => ( {
              Key: item.Key!
            } ) ),
            Quiet: true // Don't return deleted objects in response
          }
        } );

        await s3client.send( deleteCommand );
      } catch ( err ) {
        console.error(
          `Failed to delete multiple objects with prefix ${ objectKeyOrPrefix }:`,
          err
        );
        throw err;
      }
    } else if ( listedObjects.Contents && listedObjects.Contents.length === 1 ) {
      // Single object = delete directly
      try {
        const deleteCommand = new DeleteObjectCommand( {
          Bucket: bucketName,
          Key: listedObjects.Contents[ 0 ].Key!
        } );

        await s3client.send( deleteCommand );
      } catch ( err ) {
        console.error(
          `Failed to delete object ${ objectKeyOrPrefix }:`,
          err
        );
        throw err;
      }
    } else {
      // No objects found - this is OK, might have been deleted already
      console.warn( `No objects found with prefix ${ objectKeyOrPrefix }, skipping deletion` );
    }
  } catch ( err ) {
    // Re-throw to let caller handle
    throw err;
  }
}
