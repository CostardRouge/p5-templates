import downloadObjectResponse from "../downloadObjectResponse";
import {
  getObjectStream
} from "@/lib/connections/s3";

jest.mock(
  "@/lib/connections/s3",
  () => ( {
    getObjectStream: jest.fn()
  } )
);

const mockedGetObjectStream = getObjectStream as jest.MockedFunction<typeof getObjectStream>;

function body( text: string ) {
  return new Response( text ).body;
}

describe(
  "downloadObjectResponse",
  () => {
    beforeEach( () => {
      jest.clearAllMocks();
      jest.spyOn(
        console,
        "error"
      ).mockImplementation( () => {} );
    } );

    afterEach( () => {
      jest.restoreAllMocks();
    } );

    it(
      "streams the object from the internal client as an attachment named after the key",
      async() => {
        mockedGetObjectStream.mockResolvedValue( {
          body: body( "video-bytes" ),
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": "11"
          }
        } );

        const response = await downloadObjectResponse( "job-1/rings-1080x1350-job-1.mp4" );

        expect( mockedGetObjectStream ).toHaveBeenCalledWith( "job-1/rings-1080x1350-job-1.mp4" );
        expect( response.status ).toBe( 200 );
        expect( response.headers.get( "content-type" ) ).toBe( "video/mp4" );
        expect( response.headers.get( "content-length" ) ).toBe( "11" );
        expect( response.headers.get( "content-disposition" ) ).toBe( "attachment; filename=\"rings-1080x1350-job-1.mp4\"" );
        expect( await response.text() ).toBe( "video-bytes" );
      }
    );

    it(
      "uses the given file name, and keeps it inside the quoted header value",
      async() => {
        mockedGetObjectStream.mockResolvedValue( {
          body: body( "{}" ),
          status: 200,
          headers: {}
        } );

        const response = await downloadObjectResponse(
          "job-1/options.json",
          "a\"b\r\nc.json"
        );

        expect( response.headers.get( "content-type" ) ).toBe( "application/json" );
        expect( response.headers.get( "content-disposition" ) ).toBe( "attachment; filename=\"a_b__c.json\"" );
      }
    );

    it(
      "answers 502 when the object cannot be read",
      async() => {
        mockedGetObjectStream.mockRejectedValue( Object.assign(
          new Error( "NoSuchKey" ),
          {
            name: "NoSuchKey"
          }
        ) );

        const response = await downloadObjectResponse( "job-1/missing.mp4" );

        expect( response.status ).toBe( 502 );
      }
    );
  }
);
