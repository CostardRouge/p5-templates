import {
  GET
} from "../schema/route";
import {
  POST
} from "../validate/route";

function post( body: string ) {
  return POST( new Request(
    "http://test/api/options/validate",
    {
      method: "POST",
      body
    }
  ) );
}

describe(
  "/api/options/schema",
  () => {
    it(
      "describes the document, content item types included",
      async() => {
        const schema = await GET().json();
        const text = JSON.stringify( schema );

        expect( Object.keys( schema.properties ) ).toEqual( expect.arrayContaining( [
          "size",
          "animation",
          "content",
          "slides",
          "assets",
          "sketch"
        ] ) );
        expect( text ).toContain( "\"const\":\"text\"" );
        expect( text ).toContain( "\"const\":\"image\"" );
      }
    );
  }
);

describe(
  "/api/options/validate",
  () => {
    it(
      "accepts a document the page would parse",
      async() => {
        expect( await ( await post( JSON.stringify( {
          size: {
            width: 1080,
            height: 1920
          },
          content: [
            {
              type: "text",
              content: "hello"
            }
          ]
        } ) ) ).json() ).toEqual( {
          valid: true,
          issues: []
        } );
      }
    );

    it(
      "names each problem by path",
      async() => {
        const body = await ( await post( JSON.stringify( {
          size: {
            width: 20,
            height: 1350
          },
          content: [
            {
              type: "nope"
            }
          ]
        } ) ) ).json();

        expect( body.valid ).toBe( false );
        expect( body.issues.map( ( issue: { path: string } ) => issue.path ) ).toEqual( expect.arrayContaining( [
          "size.width",
          "content.0.type"
        ] ) );
      }
    );

    it(
      "reports a key the parse would silently drop",
      async() => {
        const body = await ( await post( JSON.stringify( {
          content: [
            {
              type: "text",
              text: "hello"
            }
          ]
        } ) ) ).json();

        expect( body.valid ).toBe( false );
        expect( body.issues[ 0 ].path ).toBe( "content.0.text" );
        expect( body.issues[ 0 ].message ).toMatch( /^Unknown key, not part of the options schema — known here: .*content/ );
      }
    );

    it(
      "refuses a body that is not JSON, or too large",
      async() => {
        expect( ( await post( "{" ) ).status ).toBe( 400 );
        expect( ( await post( `"${ "x".repeat( 2_000_001 ) }"` ) ).status ).toBe( 413 );
      }
    );
  }
);
