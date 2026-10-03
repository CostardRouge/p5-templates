import {
  GET
} from "../route";
import {
  getObjectStream
} from "@/lib/connections/s3";

jest.mock(
  "@/lib/connections/s3",
  () => ( {
    getObjectStream: jest.fn(),
    getObjectSize: jest.fn()
  } )
);

const mockedGetObjectStream = getObjectStream as jest.MockedFunction<typeof getObjectStream>;

function get( key: string[] ) {
  return GET(
    new Request( `http://localhost/api/s3/${ key.join( "/" ) }` ),
    {
      params: Promise.resolve( {
        key
      } )
    }
  );
}

describe(
  "GET /api/s3/[...key]",
  () => {
    it.each( [
      [
        "text/html"
      ],
      [
        "image/svg+xml"
      ],
      [
        "image/jpeg"
      ],
      [
        "video/mp4"
      ]
    ] )(
      "serves %s sandboxed and unsniffable, so an uploaded page cannot run as this origin",
      async( contentType ) => {
        mockedGetObjectStream.mockResolvedValue( {
          body: null,
          status: 200,
          headers: {
            "content-type": contentType,
            "accept-ranges": "bytes"
          }
        } );

        const response = await get( [
          "job",
          "assets",
          "upload"
        ] );

        expect( response.status ).toBe( 200 );
        expect( response.headers.get( "content-type" ) ).toBe( contentType );
        expect( response.headers.get( "x-content-type-options" ) ).toBe( "nosniff" );
        expect( response.headers.get( "content-security-policy" ) ).toBe( "sandbox" );
      }
    );

    it(
      "keeps the range answer and the cache policy",
      async() => {
        mockedGetObjectStream.mockResolvedValue( {
          body: null,
          status: 206,
          headers: {
            "content-type": "video/mp4",
            "content-range": "bytes 0-1/100"
          }
        } );

        const response = await get( [
          "job",
          "video.mp4"
        ] );

        expect( response.status ).toBe( 206 );
        expect( response.headers.get( "content-range" ) ).toBe( "bytes 0-1/100" );
        expect( response.headers.get( "cache-control" ) ).toBe( "private, max-age=3600" );
      }
    );
  }
);
