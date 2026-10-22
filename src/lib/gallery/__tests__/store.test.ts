import {
  memoryBackend
} from "../memoryBackend";
import {
  GalleryStore
} from "../store";
import type {
  GalleryEntry
} from "../types";

export function entry( patch: Partial<GalleryEntry> & { id: string } ): GalleryEntry {
  return {
    at: 1,
    sketch: "p5/voronoi/voronoi-v1-cells",
    engine: "p5",
    name: "voronoi-v1-cells",
    title: "",
    origin: "keep",
    options: {
      name: "voronoi-v1-cells"
    },
    fingerprint: `fp-${ patch.id }`,
    hadAssets: false,
    width: 1080,
    height: 1350,
    thumbnail: null,
    ...patch
  };
}

describe(
  "gallery store",
  () => {
    it(
      "lists newest first, filtered by sketch and dates, without the heavy fields",
      async() => {
        const store = new GalleryStore( memoryBackend( [
          entry( {
            id: "a",
            at: 100
          } ),
          entry( {
            id: "b",
            at: 300,
            sketch: "threejs/dragon/dragon-corridor",
            thumbnail: new Blob( [
              "jpg"
            ] )
          } ),
          entry( {
            id: "c",
            at: 200
          } )
        ] ) );

        expect( ( await store.list() ).map( ( item ) => item.id ) ).toEqual( [
          "b",
          "c",
          "a"
        ] );
        expect( ( await store.list( {
          sketch: "p5/voronoi/voronoi-v1-cells"
        } ) ).map( ( item ) => item.id ) ).toEqual( [
          "c",
          "a"
        ] );
        expect( ( await store.list( {
          since: 150,
          until: 250
        } ) ).map( ( item ) => item.id ) ).toEqual( [
          "c"
        ] );
        expect( ( await store.list( {
          limit: 1
        } ) )[ 0 ] ).toMatchObject( {
          id: "b",
          hasThumbnail: true
        } );
        expect( ( await store.list() )[ 0 ] ).not.toHaveProperty( "options" );
        expect( ( await store.latestOf( "p5/voronoi/voronoi-v1-cells" ) )?.id ).toBe( "c" );
      }
    );

    it(
      "prunes the oldest past the cap, renames, removes, and tells its listeners",
      async() => {
        const store = new GalleryStore(
          memoryBackend(),
          2
        );
        let notified = 0;

        store.subscribe( () => {
          notified += 1;
        } );

        await store.add( entry( {
          id: "a",
          at: 1
        } ) );
        await store.add( entry( {
          id: "b",
          at: 2
        } ) );
        expect( await store.add( entry( {
          id: "c",
          at: 3
        } ) ) ).toEqual( [
          "a"
        ] );
        expect( await store.count() ).toBe( 2 );
        expect( await store.get( "a" ) ).toBeUndefined();

        expect( ( await store.rename(
          "b",
          "  Blue dusk  "
        ) )?.title ).toBe( "Blue dusk" );
        expect( ( await store.get( "b" ) )?.title ).toBe( "Blue dusk" );
        expect( await store.rename(
          "zz",
          "x"
        ) ).toBeUndefined();

        expect( await store.remove( "b" ) ).toBe( true );
        expect( await store.remove( "b" ) ).toBe( false );
        expect( ( await store.list() ).map( ( item ) => item.id ) ).toEqual( [
          "c"
        ] );
        expect( notified ).toBe( 5 );
      }
    );
  }
);
