import {
  GetObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";

const s3client = new S3Client( {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
} );

export async function uploadArtifact(
  objectKey: string,
  fileStream: Buffer
): Promise<string> {
  await s3client.send( new PutObjectCommand( {
    Bucket: process.env.S3_BUCKET!,
    Key: objectKey,
    Body: fileStream,
    ACL: ObjectCannedACL.public_read,
  } ) );

  return objectKey;
}

export async function getDownloadUrlFromS3Url(
  objectKey: string, expiresInSeconds = 3600
): Promise<string> {
  return await getSignedUrl(
    s3client,
    new GetObjectCommand( {
      Bucket: process.env.S3_BUCKET!,
      Key: objectKey,
    } ),
    {
      expiresIn: expiresInSeconds,
    }
  );
}

export async function deleteArtifact( objectKeyOrPrefix: string ): Promise<void> {
  const bucketName = process.env.S3_BUCKET!;

  // 1. Check if it's a folder (ends with slash or acts as prefix)
  const listedObjects = await s3client.send( new ListObjectsV2Command( {
    Bucket: bucketName,
    Prefix: objectKeyOrPrefix,
  } ) );

  if ( listedObjects.Contents && listedObjects.Contents.length > 1 ) {
    // Multiple objects = treat as folder (prefix)
    const deleteCommand = new DeleteObjectsCommand( {
      Bucket: bucketName,
      Delete: {
        Objects: listedObjects.Contents.map( ( item ) => ( {
          Key: item.Key!,
        } ) ),
      },
    } );

    await s3client.send( deleteCommand );
  } else {
    // Single object = delete directly
    const deleteCommand = new DeleteObjectCommand( {
      Bucket: bucketName,
      Key: objectKeyOrPrefix,
    } );

    await s3client.send( deleteCommand );
  }
}