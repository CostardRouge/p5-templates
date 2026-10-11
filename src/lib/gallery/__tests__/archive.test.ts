import {
  exportGallery, galleryArchiveFileName, importGallery, parseGalleryArchive, serializeGallery
} from "../archive";
import {
  memoryBackend
} from "../memoryBackend";
import {
  GalleryStore
} from "../store";
import {
  entry
} from "./store.test";

describe(
  "gallery archive",
  () => {
    it(
      "round-trips entries and their thumbnails through one JSON file",
      async() => {
        const thumbnail = new Blob(
          [
            new Uint8Array( [
              255,
              216,
              255,
              0,
              1,
              2
            ] )
          ],
          {
            type: "image/jpeg"
          }
        );
        const source = new GalleryStore( memoryBackend( [
          entry( {
            id: "a",
            at: 10,
            title: "First",
            thumbnail
          } ),
          entry( {
            id: "b",
            at: 20,
            origin: "export"
          } )
        ] ) );
        const blob = await exportGallery( source );

        expect( blob.type ).toBe( "application/json" );

        const text = await blob.text();
        const parsed = JSON.parse( text );

        expect( parsed ).toMatchObject( {
          format: "sketchbook-gallery",
          version: 1
        } );
        expect( parsed.entries ).toHaveLength( 2 );
        expect( parsed.entries[ 1 ].thumbnail ).toEqual( {
          type: "image/jpeg",
          base64: "/9j/AAEC"
        } );

        const target = new GalleryStore( memoryBackend() );

        expect( await importGallery(
          target,
          text
        ) ).toEqual( {
          added: 2,
          skipped: 0,
          pruned: 0
        } );

        const restored = await target.get( "a" );

        expect( restored ).toMatchObject( {
          title: "First",
          origin: "keep",
          options: {
            name: "voronoi-v1-cells"
          }
        } );
        expect( restored?.thumbnail?.type ).toBe( "image/jpeg" );
        expect( new Uint8Array( await restored!.thumbnail!.arrayBuffer() ) ).toEqual( new Uint8Array( [
          255,
          216,
          255,
          0,
          1,
          2
        ] ) );
        expect( ( await target.list() ).map( ( item ) => item.id ) ).toEqual( [
          "b",
          "a"
        ] );
      }
    );

    it(
      "merges without duplicates: same id, or the same piece under another id",
      async() => {
        const store = new GalleryStore( memoryBackend( [
          entry( {
            id: "a",
            fingerprint: "same"
          } )
        ] ) );
        const text = await serializeGallery( [
          entry( {
            id: "a",
            title: "renamed elsewhere"
          } ),
          entry( {
            id: "other-browser",
            fingerprint: "same"
          } ),
          entry( {
            id: "c",
            fingerprint: "new"
          } )
        ] );

        expect( await importGallery(
          store,
          text
        ) ).toEqual( {
          added: 1,
          skipped: 2,
          pruned: 0
        } );
        expect( ( await store.get( "a" ) )?.title ).toBe( "" );
        expect( await store.count() ).toBe( 2 );
      }
    );

    it(
      "refuses what is not an archive, naming the problem",
      () => {
        expect( () => parseGalleryArchive( "{" ) ).toThrow( "not JSON" );
        expect( () => parseGalleryArchive( "{\"name\":\"voronoi\"}" ) ).toThrow( "not a Sketchbook gallery archive" );
        expect( () => parseGalleryArchive( JSON.stringify( {
          format: "sketchbook-gallery",
          version: 2,
          entries: []
        } ) ) ).toThrow( "version 2" );
        expect( () => parseGalleryArchive( JSON.stringify( {
          format: "sketchbook-gallery",
          version: 1,
          entries: [
            {
              id: "x"
            }
          ]
        } ) ) ).toThrow( "entry 0: \"at\" is not a date" );
        expect( () => parseGalleryArchive( JSON.stringify( {
          format: "sketchbook-gallery",
          version: 1,
          entries: [
            {
              ...entry( {
                id: "x"
              } ),
              thumbnail: "nope"
            }
          ]
        } ) ) ).toThrow( "thumbnail" );
        expect( galleryArchiveFileName( new Date( "2026-10-11T12:00:00Z" ) ) ).toBe( "sketchbook-gallery-2026-10-11.json" );
      }
    );
  }
);
