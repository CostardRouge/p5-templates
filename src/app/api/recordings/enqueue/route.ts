import {
  NextRequest, NextResponse
} from "next/server";
import {
  RecordingService
} from "@/services/RecordingService";
import {
  EnqueueRecordingResponse
} from "@/types/recording.types";

export async function POST( request: NextRequest ): Promise<NextResponse<EnqueueRecordingResponse>> {
  try {
    const formData = await request.formData();

    const template = formData.get( "template" );

    if ( !template || typeof template !== "string" ) {
      return NextResponse.json(
        {
          success: false,
          error: "Template is required"
        },
        {
          status: 400
        }
      );
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

    const options = JSON.parse( optionsRaw );
    const slides = options.slides ?? [
    ];

    options.assets = {
    };

    if ( options.assets?.images ) {
      options.assets.images = [
      ];
    }

    for ( const slide of slides ) {
      slide.assets = {
      };
    }

    const collectedFiles: File[] = [
    ];

    for ( const [
      key,
      value
    ] of formData.entries() ) {
      if ( !key.startsWith( "file[" ) ) continue;
      if ( !( value instanceof File ) ) continue;

      // Match keys like file[slide-1][images]
      const match = key.match( /^file\[(global|slide-(\d+))]\[(\w+)]$/ );

      if ( !match ) continue;

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

      // Update options object
      if ( scope === "global" ) {
        options.assets[ type ] = options.assets[ type ] || [
        ];
        options.assets[ type ].push( filename );
      } else if ( slideIndex !== null ) {
        slides[ slideIndex ] = slides[ slideIndex ] || {
        };
        slides[ slideIndex ].assets = slides[ slideIndex ].assets || {
        };
        slides[ slideIndex ].assets[ type ] = slides[ slideIndex ].assets[ type ] || [
        ];
        slides[ slideIndex ].assets[ type ].push( filename );
      }

      collectedFiles.push( value );
    }

    options.slides = slides;

    // console.log( {
    //   collectedFiles,
    //   opt: options.assets
    // } );
    // return collectedFiles;

    const recordingService = RecordingService.getInstance();
    const jobId = await recordingService.enqueueRecording(
      template,
      JSON.stringify( options ),
      collectedFiles
    );

    return NextResponse.json( {
      success: true,
      jobId
    } );
  } catch ( error ) {
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
