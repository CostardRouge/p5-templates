import {
  NextRequest, NextResponse
} from "next/server";
import {
  v4 as generateUuid
} from "uuid";
import {
  EnqueueRecordingResponse
} from "@/types/recording.types";
import {
  getJobById, createJob, updateJob
} from "@/lib/jobStore";
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  ObjectCannedACL
} from "@aws-sdk/client-s3";
import {
  uploadArtifact
} from "@/lib/connections/s3";

const s3client = new S3Client( {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  },
  forcePathStyle: true
} );

export async function POST(
  _request: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string;
    }>;
  }
): Promise<NextResponse<EnqueueRecordingResponse>> {
  try {
    const {
      id: originalJobId
    } = await params;

    // Fetch the original job
    const originalJob = await getJobById( originalJobId );

    if ( !originalJob ) {
      return NextResponse.json(
        {
          success: false,
          error: "Recording not found"
        },
        {
          status: 404
        }
      );
    }

    // Generate new job ID
    const newJobId = generateUuid();

    // Parse options and update the ID
    const options =
      typeof originalJob.options === "string"
        ? JSON.parse( originalJob.options )
        : originalJob.options;

    options.id = newJobId;

    // Create new job record in database
    await createJob(
      newJobId,
      originalJob.sketch,
      "draft"
    );

    // List all objects in the original job's S3 folder
    const bucketName = process.env.S3_BUCKET!;
    const listCommand = new ListObjectsV2Command( {
      Bucket: bucketName,
      Prefix: `${ originalJobId }/`
    } );

    const listedObjects = await s3client.send( listCommand );

    if ( listedObjects.Contents && listedObjects.Contents.length > 0 ) {
      // Copy each object to the new job folder
      await Promise.all( listedObjects.Contents.map( async( object ) => {
        if ( !object.Key ) {
          return;
        }

        // Get the relative path within the job folder
        const relativePath = object.Key.replace(
          `${ originalJobId }/`,
          ""
        );
        const newKey = `${ newJobId }/${ relativePath }`;

        // Copy the object
        const copyCommand = new CopyObjectCommand( {
          Bucket: bucketName,
          CopySource: `${ bucketName }/${ object.Key }`,
          Key: newKey,
          ACL: ObjectCannedACL.public_read
        } );

        await s3client.send( copyCommand );
      } ) );
    }

    // Update the options.json with the new job ID
    await uploadArtifact(
      `${ newJobId }/options.json`,
      Buffer.from( JSON.stringify(
        options,
        null,
        2
      ) )
    );

    // Update job record with options
    await updateJob(
      newJobId,
      {
        options
      }
    );

    console.log( `[API] Cloned recording ${ originalJobId } to ${ newJobId }` );

    return NextResponse.json( {
      success: true,
      jobId: newJobId
    } );
  } catch( error ) {
    console.error(
      "[API] Error cloning recording:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error"
      },
      {
        status: 500
      }
    );
  }
}
