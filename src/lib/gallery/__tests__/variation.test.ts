import {
  parseGalleryArchive, serializeGallery
} from "../archive";
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
  readVariationMark, summarize
} from "../types";

const input = (
  palette: string, at: number, variation?: Parameters<typeof keepPiece>[ 1 ][ "variation" ]
) => ( {
  engine: "p5",
  category: "voronoi",
  name: "voronoi-v1-cells",
  options: {
    sketch: {
      palette
    }
  },
  origin: "agent" as const,
  thumbnail: null,
  at,
  ...( variation
    ? {
      variation
    }
    : {} )
} );

describe(
  "the variation mark",
  () => {
    it(
      "is kept with a piece, read by a listing, and changed only through mark",
      async() => {
        const store = new GalleryStore( memoryBackend() );
        const {
          entry
        } = await keepPiece(
          store,
          input(
            "ice",
            1,
            {
              state: "candidate",
              by: "agent",
              label: "Palette: Ice"
            }
          )
        );

        expect( summarize( entry ).variation ).toEqual( {
          state: "candidate",
          by: "agent",
          label: "Palette: Ice"
        } );

        await store.mark(
          entry.id,
          {
            ...entry.variation!,
            state: "accepted"
          }
        );
        expect( ( await store.get( entry.id ) )!.variation!.state ).toBe( "accepted" );
        await store.mark(
          entry.id,
          null
        );
        expect( "variation" in ( await store.get( entry.id ) )! ).toBe( false );
        expect( await store.mark(
          "nope",
          null
        ) ).toBeUndefined();
      }
    );

    it(
      "marks the piece already kept rather than keeping it twice, and never undoes his yes",
      async() => {
        const store = new GalleryStore( memoryBackend() );
        const plain = await keepPiece(
          store,
          input(
            "ice",
            1
          )
        );
        const again = await keepPiece(
          store,
          input(
            "ice",
            2,
            {
              state: "candidate",
              by: "agent"
            }
          )
        );

        expect( again.kept ).toBe( false );
        expect( again.entry.id ).toBe( plain.entry.id );
        expect( again.entry.variation?.state ).toBe( "candidate" );

        await store.mark(
          plain.entry.id,
          {
            state: "accepted",
            by: "agent"
          }
        );

        const third = await keepPiece(
          store,
          input(
            "ice",
            3,
            {
              state: "candidate",
              by: "agent"
            }
          )
        );

        expect( third.entry.variation?.state ).toBe( "accepted" );
        expect( await store.count() ).toBe( 1 );
      }
    );

    it(
      "survives the archive, and a mark that is not one is dropped",
      async() => {
        const store = new GalleryStore( memoryBackend() );

        await keepPiece(
          store,
          input(
            "ice",
            1,
            {
              state: "accepted",
              by: "person",
              label: "Ice"
            }
          )
        );

        const [
          back
        ] = parseGalleryArchive( await serializeGallery( await store.entries() ) );

        expect( back.variation ).toEqual( {
          state: "accepted",
          by: "person",
          label: "Ice"
        } );
        expect( readVariationMark( {
          state: "approved"
        } ) ).toBeUndefined();
        expect( readVariationMark( "candidate" ) ).toBeUndefined();
        expect( readVariationMark( {
          state: "candidate",
          by: "robot",
          label: "  "
        } ) ).toEqual( {
          state: "candidate",
          by: "person"
        } );
      }
    );
  }
);
