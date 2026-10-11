import {
  canonicalDocument, documentHasAssets, fingerprintDocument
} from "../canonical";

describe(
  "canonical document and fingerprint",
  () => {
    it(
      "is the same string whatever the key order, and ignores the root id",
      () => {
        const a = {
          id: "job-1",
          sketch: {
            b: 2,
            a: [
              1,
              {
                y: 1,
                x: 2
              }
            ]
          },
          name: "voronoi"
        };
        const b = {
          name: "voronoi",
          sketch: {
            a: [
              1,
              {
                x: 2,
                y: 1
              }
            ],
            b: 2
          }
        };

        expect( canonicalDocument( a ) ).toBe( canonicalDocument( b ) );
        expect( canonicalDocument( a ) ).toBe( "{\"name\":\"voronoi\",\"sketch\":{\"a\":[1,{\"x\":2,\"y\":1}],\"b\":2}}" );
        expect( fingerprintDocument( a ) ).toBe( fingerprintDocument( b ) );
      }
    );

    it(
      "changes with any leaf, and keeps a nested id",
      () => {
        const base = {
          sketch: {
            hue: 1
          },
          slides: [
            {
              id: "s1"
            }
          ]
        };

        expect( fingerprintDocument( base ) ).not.toBe( fingerprintDocument( {
          ...base,
          sketch: {
            hue: 1.0001
          }
        } ) );
        expect( fingerprintDocument( base ) ).not.toBe( fingerprintDocument( {
          ...base,
          slides: [
            {
              id: "s2"
            }
          ]
        } ) );
        expect( fingerprintDocument( base ) ).toMatch( /^[0-9a-f]{16}-[0-9a-z]+$/ );
      }
    );

    it(
      "spots an uploaded asset path anywhere in the document",
      () => {
        expect( documentHasAssets( {
          sketch: {
            photo: {
              image: "assets/images/test/one.jpg"
            }
          }
        } ) ).toBe( false );
        expect( documentHasAssets( {
          assets: {
            images: [
              "global/images/IMG_1821.jpeg"
            ]
          }
        } ) ).toBe( true );
        expect( documentHasAssets( {
          slides: [
            {
              content: [
                {
                  type: "image",
                  source: "slide-0/images/image.jpg"
                }
              ]
            }
          ]
        } ) ).toBe( true );
        expect( documentHasAssets( {
          assets: {
            images: []
          },
          content: []
        } ) ).toBe( false );
      }
    );
  }
);
