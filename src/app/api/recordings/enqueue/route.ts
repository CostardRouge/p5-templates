import {
  NextRequest, NextResponse
} from "next/server";
import {
  RecordingService
} from "@/services/RecordingService";
import {
  EnqueueRecordingResponse
} from "@/types/recording.types";
import {
  isSafeJobId,
  isSafeObjectPath,
  isSubmittableStatus
} from "@/lib/recordingInput";

function badRequest( error: string ): NextResponse<EnqueueRecordingResponse> {
  return NextResponse.json(
    {
      success: false,
      error
    },
    {
      status: 400
    }
  );
}

function parseJson( raw: string ): {
  ok: true;
  value: any;
} | {
  ok: false;
} {
  try {
    return {
      ok: true,
      value: JSON.parse( raw )
    };
  } catch {
    return {
      ok: false
    };
  }
}

export async function POST( request: NextRequest ): Promise<NextResponse<EnqueueRecordingResponse>> {
  try {
    const formData = await request.formData();
    const jobIdRaw = formData.get( "jobId" );
    // "sketch" is the canonical field; "template" is accepted for older
    // clients and scripts recorded against the pre-rename API.
    const sketch = formData.get( "sketch" ) ?? formData.get( "template" );
    const status = formData.get( "status" ) ?? "queued";
    const thumbnailsRaw = formData.get( "thumbnails" );

    // The id becomes an S3 folder and a temp directory, so only an id the
    // server could have minted is accepted; an empty one means "mint one".
    if ( typeof jobIdRaw === "string" && jobIdRaw !== "" && !isSafeJobId( jobIdRaw ) ) {
      return badRequest( "Invalid jobId" );
    }

    if ( !isSubmittableStatus( status ) ) {
      return badRequest( "Status must be \"draft\" or \"queued\"" );
    }

    let thumbnails: Record<string, string> | undefined;

    if ( thumbnailsRaw && typeof thumbnailsRaw === "string" ) {
      const parsedThumbnails = parseJson( thumbnailsRaw );

      if ( !parsedThumbnails.ok ) {
        return badRequest( "Thumbnails must be valid JSON" );
      }

      thumbnails = parsedThumbnails.value;
    }

    if ( !sketch || typeof sketch !== "string" ) {
      return NextResponse.json(
        {
          success: false,
          error: "Sketch is required"
        },
        {
          status: 400
        }
      );
    }

    // A route path ("sketches/p5/…"): it is stored on the job, loaded by the
    // capture browser and written into a download's Content-Disposition.
    if ( !isSafeObjectPath( sketch ) ) {
      return badRequest( "Invalid sketch path" );
    }

    const optionsRaw = formData.get( "options" );

    if ( !optionsRaw || typeof optionsRaw !== "string" ) {
      return NextResponse.json(
        {
          success: false,
          error: "Options is required"
        },
        {
          status: 400
        }
      );
    }

    const parsedOptions = parseJson( optionsRaw );

    if ( !parsedOptions.ok || typeof parsedOptions.value !== "object" || parsedOptions.value === null ) {
      return badRequest( "Options must be a JSON object" );
    }

    const options = parsedOptions.value;
    const slides = Array.isArray( options.slides ) ? options.slides : [];

    options.assets = {};

    if ( options.assets?.images ) {
      options.assets.images = [];
    }

    for ( const slide of slides ) {
      slide.assets = {};
    }

    const collectedFiles: File[] = [];

    for ( const [
      key,
      value
    ] of formData.entries() ) {
      if ( !key.startsWith( "file[" ) ) {
        continue;
      }
      if ( !( value instanceof File ) ) {
        continue;
      }

      // Match keys like file[slide-1][images]
      const match = key.match( /^file\[(global|slide-(\d+))]\[(\w+)]$/ );

      if ( !match ) {
        continue;
      }

      const [
        , scope,
        slideIndexRaw,
        type
      ] = match;
      const slideIndex = slideIndexRaw ? parseInt(
        slideIndexRaw,
        10
      ) : null;
      const filename = value.name;

      // The name is the tail of the asset's S3 key: no `..` or empty segment.
      if ( !isSafeObjectPath( filename ) ) {
        return badRequest( `Invalid asset name for ${ key }` );
      }

      // The studio only uploads for slides it sent; an index past the end
      // would grow a sparse array that JSON.stringify writes out in full.
      if ( slideIndex !== null && slideIndex >= slides.length ) {
        return badRequest( `No slide ${ slideIndex } for ${ key }` );
      }

      // Update options object
      if ( scope === "global" ) {
        options.assets[ type ] = options.assets[ type ] || [];
        options.assets[ type ].push( filename );
      } else if ( slideIndex !== null ) {
        slides[ slideIndex ] = slides[ slideIndex ] || {};
        slides[ slideIndex ].assets = slides[ slideIndex ].assets || {};
        slides[ slideIndex ].assets[ type ] = slides[ slideIndex ].assets[ type ] || [];
        slides[ slideIndex ].assets[ type ].push( filename );
      }

      collectedFiles.push( value );
    }

    options.slides = slides;

    const recordingService = RecordingService.getInstance();
    const jobId = await recordingService.enqueueRecording( {
      sketch,
      files: collectedFiles,
      status,
      options: JSON.stringify(
        options,
        null,
        2
      ),
      jobId: typeof jobIdRaw === "string" && jobIdRaw !== "" ? jobIdRaw : undefined,
      thumbnails
    } );

    return NextResponse.json( {
      success: true,
      jobId
    } );
  } catch( error ) {
    console.error(
      "[API] Error enqueuing recording:",
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
