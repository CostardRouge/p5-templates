import {
  NextRequest
} from "next/server";

import {
  GET
} from "../route";
import {
  getJobById
} from "@/lib/jobStore";
import {
  getObjectStream
} from "@/lib/connections/s3";

jest.mock(
  "@/lib/jobStore",
  () => ( {
    getJobById: jest.fn()
  } )
);

jest.mock(
  "@/lib/connections/s3",
  () => ( {
    getObjectStream: jest.fn()
  } )
);

const JOB_ID = "3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f";

describe(
  "GET /api/options/download/[id]",
  () => {
    it(
      "streams the job's options.json through the internal S3 client — no server-side fetch of a public URL",
      async() => {
        ( getJobById as jest.Mock ).mockResolvedValue( {
          id: JOB_ID,
          sketch: "sketches/p5/rings/rings-v1"
        } );
        ( getObjectStream as jest.Mock ).mockResolvedValue( {
          body: new Response( "{\"slides\":[]}" ).body,
          status: 200,
          headers: {}
        } );

        const fetchSpy = jest.spyOn(
          globalThis,
          "fetch"
        );

        const response = await GET(
          new NextRequest( `http://localhost/api/options/download/${ JOB_ID }` ),
          {
            params: Promise.resolve( {
              id: JOB_ID
            } )
          }
        );

        expect( fetchSpy ).not.toHaveBeenCalled();
        expect( getObjectStream ).toHaveBeenCalledWith( `${ JOB_ID }/options.json` );
        expect( response.status ).toBe( 200 );
        expect( response.headers.get( "content-type" ) ).toBe( "application/json" );
        expect( response.headers.get( "content-disposition" ) ).toBe( "attachment; filename=\"rings-v1-options-3f1c2a9e.json\"" );
        expect( await response.text() ).toBe( "{\"slides\":[]}" );

        fetchSpy.mockRestore();
      }
    );
  }
);
