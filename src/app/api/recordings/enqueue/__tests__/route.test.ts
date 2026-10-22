import {
  NextRequest
} from "next/server";

import {
  POST
} from "../route";
import {
  RecordingService
} from "@/services/RecordingService";

jest.mock(
  "@/services/RecordingService",
  () => ( {
    RecordingService: {
      getInstance: jest.fn()
    }
  } )
);

const enqueueRecording = jest.fn();

( RecordingService.getInstance as jest.Mock ).mockReturnValue( {
  enqueueRecording
} );

const JOB_ID = "3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f";

type Field = string | File;

function post( fields: Record<string, Field> ) {
  const form = new FormData();

  for ( const [
    key,
    value
  ] of Object.entries( fields ) ) {
    form.append(
      key,
      value
    );
  }

  return POST( new NextRequest(
    "http://localhost/api/recordings/enqueue",
    {
      method: "POST",
      body: form
    }
  ) );
}

function file( name: string ) {
  return new File(
    [
      "x"
    ],
    name,
    {
      type: "image/jpeg"
    }
  );
}

const VALID = {
  sketch: "sketches/p5/rings/rings-v1",
  status: "draft",
  options: JSON.stringify( {
    slides: [
      {}
    ]
  } )
};

describe(
  "POST /api/recordings/enqueue",
  () => {
    beforeEach( () => {
      enqueueRecording.mockReset().mockResolvedValue( JOB_ID );
      jest.spyOn(
        console,
        "error"
      ).mockImplementation( () => {} );
    } );

    afterEach( () => {
      jest.restoreAllMocks();
    } );

    it(
      "enqueues what the studio sends, scoped asset names included",
      async() => {
        const response = await post( {
          ...VALID,
          jobId: JOB_ID,
          "file[global][images]": file( "global/images/a.jpg" ),
          "file[slide-0][images]": file( "slide-0/images/b.jpg" )
        } );

        expect( response.status ).toBe( 200 );
        expect( enqueueRecording ).toHaveBeenCalledTimes( 1 );

        const call = enqueueRecording.mock.calls[ 0 ][ 0 ];

        expect( call.jobId ).toBe( JOB_ID );
        expect( call.status ).toBe( "draft" );
        expect( call.files.map( ( f: File ) => f.name ) ).toEqual( [
          "global/images/a.jpg",
          "slide-0/images/b.jpg"
        ] );
        expect( JSON.parse( call.options ).slides[ 0 ].assets ).toEqual( {
          images: [
            "slide-0/images/b.jpg"
          ]
        } );
      }
    );

    it(
      "mints an id when the client sends an empty one",
      async() => {
        const response = await post( {
          ...VALID,
          jobId: ""
        } );

        expect( response.status ).toBe( 200 );
        expect( enqueueRecording.mock.calls[ 0 ][ 0 ].jobId ).toBeUndefined();
      }
    );

    it.each( [
      [
        "a job id that is a path",
        {
          jobId: "../.."
        }
      ],
      [
        "a job id with a slash",
        {
          jobId: "other-job/assets"
        }
      ],
      [
        "a status only the worker sets",
        {
          status: "completed"
        }
      ],
      [
        "an unknown status",
        {
          status: "bogus"
        }
      ],
      [
        "options that are not JSON",
        {
          options: "{nope"
        }
      ],
      [
        "options that are not an object",
        {
          options: "42"
        }
      ],
      [
        "thumbnails that are not JSON",
        {
          thumbnails: "{nope"
        }
      ],
      [
        "a sketch path that climbs",
        {
          sketch: "../api/recordings"
        }
      ],
      [
        "a sketch path with a line break",
        {
          sketch: "sketches/p5/a\r\nX-Injected: 1"
        }
      ],
      [
        "an asset name that climbs out of the job's folder",
        {
          "file[global][images]": file( "../../other-job/options.json" )
        }
      ],
      [
        "an asset for a slide that does not exist",
        {
          "file[slide-99999999][images]": file( "slide/a.jpg" )
        }
      ]
    ] )(
      "refuses %s with a 400 and enqueues nothing",
      async(
        _label, override
      ) => {
        const response = await post( {
          ...VALID,
          ...override
        } );

        expect( response.status ).toBe( 400 );
        expect( ( await response.json() ).success ).toBe( false );
        expect( enqueueRecording ).not.toHaveBeenCalled();
      }
    );
  }
);
