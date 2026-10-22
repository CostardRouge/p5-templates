import {
  assetPath, composeDocument, listedAssets, mediaKind, storedName, uploadKey
} from "../drafts.ts";
import {
  sheetGrid
} from "../frameRenderer.ts";
import {
  contentItemTypes, schemaPart
} from "../schemaParts.ts";

describe(
  "draft media",
  () => {
    it(
      "sorts a file into the studio's pools by extension",
      () => {
        expect( mediaKind( "a.JPG" ) ).toBe( "images" );
        expect( mediaKind( "a.webm" ) ).toBe( "videos" );
        expect( mediaKind( "a.wav" ) ).toBe( "audios" );
        expect( mediaKind( "a.txt" ) ).toBeNull();
      }
    );

    it(
      "stores a file under a name an asset path admits",
      () => {
        expect( storedName( "/Users/me/My Photo (1).jpg" ) ).toBe( "My-Photo-1-.jpg" );
        expect( storedName( "..hidden.png" ) ).toBe( "hidden.png" );
        expect( () => storedName( "/etc/passwd" ) ).toThrow( /is not a media file/ );
        expect( assetPath(
          "images",
          "a.jpg"
        ) ).toBe( "global/images/a.jpg" );
      }
    );

    it(
      "lists a stored document's files, global and per slide, with the key to re-send each",
      () => {
        const assets = listedAssets( {
          assets: {
            images: [
              "global/images/a.jpg"
            ],
            videos: [],
            audios: [
              "global/audios/b.mp3"
            ]
          },
          slides: [
            {
              assets: {
                images: [
                  "slide-0/images/c.png"
                ]
              }
            },
            {}
          ]
        } );

        expect( assets ).toEqual( [
          {
            scope: "global",
            kind: "images",
            path: "global/images/a.jpg"
          },
          {
            scope: "global",
            kind: "audios",
            path: "global/audios/b.mp3"
          },
          {
            scope: 0,
            kind: "images",
            path: "slide-0/images/c.png"
          }
        ] );
        expect( assets.map( uploadKey ) ).toEqual( [
          "file[global][images]",
          "file[global][audios]",
          "file[slide-0][images]"
        ] );
      }
    );

    it(
      "composes a document: objects merge, lists replace, the sketch's parameters whole",
      () => {
        expect( composeDocument(
          {
            id: "old",
            size: {
              width: 1080,
              height: 1350
            },
            content: [
              {
                type: "text"
              }
            ],
            animation: {
              framerate: 60,
              duration: 12
            }
          },
          {
            size: {
              height: 1920
            },
            content: [
              {
                type: "image"
              }
            ]
          },
          {
            a: 1
          }
        ) ).toEqual( {
          size: {
            width: 1080,
            height: 1920
          },
          content: [
            {
              type: "image"
            }
          ],
          animation: {
            framerate: 60,
            duration: 12
          },
          sketch: {
            a: 1
          }
        } );
      }
    );
  }
);

describe(
  "contact sheets",
  () => {
    it(
      "lays cells out as square as they go",
      () => {
        expect( sheetGrid( 1 ) ).toEqual( {
          columns: 1,
          rows: 1
        } );
        expect( sheetGrid( 6 ) ).toEqual( {
          columns: 3,
          rows: 2
        } );
        expect( sheetGrid( 9 ) ).toEqual( {
          columns: 3,
          rows: 3
        } );
        expect( sheetGrid( 10 ) ).toEqual( {
          columns: 4,
          rows: 3
        } );
      }
    );
  }
);

describe(
  "the document schema, a part at a time",
  () => {
    const SCHEMA = {
      type: "object",
      properties: {
        size: {
          type: "object",
          properties: {
            width: {
              type: "number"
            }
          }
        },
        content: {
          type: "array",
          items: {
            oneOf: [
              {
                type: "object",
                properties: {
                  type: {
                    const: "text"
                  },
                  content: {},
                  font: {}
                }
              },
              {
                type: "object",
                properties: {
                  type: {
                    const: "image"
                  },
                  source: {}
                }
              }
            ]
          }
        }
      }
    };

    it(
      "finds the content item types by their constant",
      () => {
        expect( Object.keys( contentItemTypes( SCHEMA ) ) ).toEqual( [
          "text",
          "image"
        ] );
      }
    );

    it(
      "answers an overview, the item list, one item, one field or everything",
      () => {
        expect( schemaPart( SCHEMA ) ).toMatchObject( {
          contentTypes: [
            "text",
            "image"
          ],
          parts: {
            size: "canvas size in px"
          }
        } );
        expect( schemaPart(
          SCHEMA,
          "content"
        ) ).toEqual( {
          text: [
            "content",
            "font"
          ],
          image: [
            "source"
          ]
        } );
        expect( schemaPart(
          SCHEMA,
          "content.image"
        ) ).toBe( SCHEMA.properties.content.items.oneOf[ 1 ] );
        expect( schemaPart(
          SCHEMA,
          "size"
        ) ).toBe( SCHEMA.properties.size );
        expect( schemaPart(
          SCHEMA,
          "all"
        ) ).toBe( SCHEMA );
        expect( () => schemaPart(
          SCHEMA,
          "colour"
        ) ).toThrow( "no part \"colour\" — size, content, content.<type>, all" );
      }
    );
  }
);
