import {
  keepPiece
} from "../keep";
import {
  memoryBackend
} from "../memoryBackend";
import {
  GalleryStore
} from "../store";
import {
  dataUrlToBlob
} from "../thumbnail";

const document = {
  id: "job-9",
  size: {
    width: 540,
    height: 675
  },
  sketch: {
    hue: 1
  },
  assets: {
    images: [
      "global/images/one.jpg"
    ]
  }
};

describe(
  "keepPiece",
  () => {
    it(
      "stores a cloned, named document with its size and asset flag",
      async() => {
        const store = new GalleryStore( memoryBackend() );
        const thumbnail = new Blob( [
          "jpg"
        ] );
        const {
          entry, kept
        } = await keepPiece(
          store,
          {
            engine: "p5",
            category: "voronoi",
            name: "voronoi-v1-cells",
            options: document,
            origin: "keep",
            title: " First ",
            thumbnail,
            at: 42
          }
        );

        expect( kept ).toBe( true );
        expect( entry ).toMatchObject( {
          at: 42,
          sketch: "p5/voronoi/voronoi-v1-cells",
          engine: "p5",
          name: "voronoi-v1-cells",
          title: "First",
          origin: "keep",
          hadAssets: true,
          width: 540,
          height: 675,
          thumbnail
        } );
        expect( entry.options ).toEqual( {
          ...document,
          name: "voronoi-v1-cells"
        } );
        expect( entry.options ).not.toBe( document );
        expect( await store.count() ).toBe( 1 );
      }
    );

    it(
      "does not store the same document twice in a row, but takes a new title",
      async() => {
        const store = new GalleryStore( memoryBackend() );
        const input = {
          engine: "p5",
          name: "noise-v1",
          options: document,
          origin: "export" as const,
          thumbnail: null
        };
        const first = await keepPiece(
          store,
          input
        );
        const again = await keepPiece(
          store,
          {
            ...input,
            options: {
              ...document,
              id: "another-job"
            },
            title: "Named later"
          }
        );

        expect( again.kept ).toBe( false );
        expect( again.entry.id ).toBe( first.entry.id );
        expect( again.entry.title ).toBe( "Named later" );
        expect( await store.count() ).toBe( 1 );

        const changed = await keepPiece(
          store,
          {
            ...input,
            options: {
              ...document,
              sketch: {
                hue: 2
              }
            }
          }
        );

        expect( changed.kept ).toBe( true );
        expect( await store.count() ).toBe( 2 );

        // Back to the first document: the NEWEST entry differs, so it is kept again.
        expect( ( await keepPiece(
          store,
          input
        ) ).kept ).toBe( true );
      }
    );

    it(
      "falls back to the studio's default size and decodes a data URL",
      async() => {
        const store = new GalleryStore( memoryBackend() );
        const {
          entry
        } = await keepPiece(
          store,
          {
            engine: "gsap",
            name: "hello-gsap",
            options: {},
            origin: "agent",
            thumbnail: null
          }
        );

        expect( entry ).toMatchObject( {
          sketch: "gsap/hello-gsap",
          width: 1080,
          height: 1350,
          hadAssets: false
        } );

        const blob = dataUrlToBlob( "data:image/jpeg;base64,/9j/4AAQ" );

        expect( blob?.type ).toBe( "image/jpeg" );
        expect( blob?.size ).toBe( 6 );
        expect( dataUrlToBlob( "nope" ) ).toBeNull();
      }
    );
  }
);
