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

import fs from "node:fs";
import path from "path";

const s3 = new S3Client( {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
} );

export async function uploadArtifact(
  jobId: string,
  localPath: string
): Promise<string> {
  const bucketName = process.env.S3_BUCKET!;
  const baseName = path.basename( localPath );
  const s3Key = `${ jobId }/${ baseName }`;

  const fileStream = fs.createReadStream( localPath );

  const putParams = {
    Bucket: bucketName,
    Key: s3Key,
    Body: fileStream,
    ACL: ObjectCannedACL.public_read,
  };

  await s3.send( new PutObjectCommand( putParams ) );

  return s3Key;
}

export async function getDownloadUrlFromS3Url(
  objectKey: string, expiresInSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand( {
    Bucket: process.env.S3_BUCKET!,
    Key: objectKey,
  } );

  return await getSignedUrl(
    s3,
    command,
    {
      expiresIn: expiresInSeconds,
    }
  );
}

export async function deleteArtifact( objectKeyOrPrefix: string ): Promise<void> {
  const bucketName = process.env.S3_BUCKET!;

  // 1. Check if it's a folder (ends with slash or acts as prefix)
  const listCommand = new ListObjectsV2Command( {
    Bucket: bucketName,
    Prefix: objectKeyOrPrefix,
  } );

  const listedObjects = await s3.send( listCommand );

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

    await s3.send( deleteCommand );
  } else {
    // Single object = delete directly
    const deleteCommand = new DeleteObjectCommand( {
      Bucket: bucketName,
      Key: objectKeyOrPrefix,
    } );

    await s3.send( deleteCommand );
  }
}