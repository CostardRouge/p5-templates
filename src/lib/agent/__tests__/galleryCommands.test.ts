import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  galleryCommands
} from "../commands/galleryCommands";
import {
  fakeHandles
} from "./fakeHandles";

function setup( document: Record<string, any> = {
  size: {
    width: 540,
    height: 675
  },
  sketch: {
    render: {
      hueSpeed: 1
    }
  }
} ) {
  const fake = fakeHandles( document );

  fake.handles.history.canUndo = () => false;

  const registry = createCommandRegistry();

  registry.register( galleryCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "gallery commands",
  () => {
    it(
      "keep the piece on screen once, list it, look at it, remove it",
      async() => {
        const {
          registry, handles
        } = setup();
        const kept = await registry.execute(
          "gallery.keep",
          {
            title: "Dusk"
          }
        ) as Record<string, unknown>;

        expect( kept ).toMatchObject( {
          sketch: "p5/voronoi/voronoi-v1-cells",
          title: "Dusk",
          origin: "agent",
          size: "540×675",
          hadAssets: false,
          hasThumbnail: true,
          kept: true,
          pruned: 0
        } );
        expect( kept.at ).toMatch( /^\d{4}-\d{2}-\d{2}T/ );

        // The same document again: the entry is answered, not duplicated.
        expect( await registry.execute(
          "gallery.keep",
          {}
        ) ).toMatchObject( {
          id: kept.id,
          kept: false
        } );

        handles.setValue(
          "sketch.render.hueSpeed",
          2
        );
        const second = await registry.execute(
          "gallery.keep",
          {}
        ) as Record<string, unknown>;

        expect( second.kept ).toBe( true );

        const list = await registry.execute(
          "gallery.list",
          {
            sketch: "current"
          }
        ) as { count: number;
          total: number;
          entries: { id: string }[] };

        expect( list.count ).toBe( 2 );
        expect( list.total ).toBe( 2 );
        expect( list.entries.map( ( entry ) => entry.id ) ).toEqual( [
          second.id,
          kept.id
        ] );
        expect( ( await registry.execute(
          "gallery.list",
          {
            sketch: "threejs/dragon/dragon-corridor"
          }
        ) as { count: number } ).count ).toBe( 0 );
        expect( ( await registry.execute(
          "gallery.list",
          {
            until: "2000-01-01",
            limit: 1
          }
        ) as { count: number } ).count ).toBe( 0 );
        await expect( registry.execute(
          "gallery.list",
          {
            since: "last tuesday"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: expect.stringContaining( "since \"last tuesday\" is not a date" )
        } );

        expect( await registry.execute(
          "gallery.thumbnail",
          {
            id: kept.id
          }
        ) ).toMatchObject( {
          kind: "image",
          mimeType: "image/jpeg",
          width: 512,
          note: expect.stringContaining( "Dusk (p5/voronoi/voronoi-v1-cells, kept " )
        } );

        expect( await registry.execute(
          "gallery.remove",
          {
            id: kept.id
          }
        ) ).toEqual( {
          id: kept.id,
          removed: true,
          remaining: 1
        } );
        await expect( registry.execute(
          "gallery.remove",
          {
            id: kept.id
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: `no gallery entry "${ kept.id }" — gallery.list shows the ids`
        } );
      }
    );

    it(
      "reopen a piece of the open sketch in place, and another sketch by navigating",
      async() => {
        const {
          registry, handles, calls, document
        } = setup();
        const mine = await registry.execute(
          "gallery.keep",
          {}
        ) as { id: string };

        // An entry of another sketch, as another tab would have kept it.
        await handles.gallery.store.add( {
          id: "dragon",
          at: 5,
          sketch: "threejs/dragon/dragon-corridor",
          engine: "threejs",
          name: "dragon-corridor",
          title: "",
          origin: "keep",
          options: {
            name: "dragon-corridor",
            size: {
              width: 540,
              height: 676
            }
          },
          fingerprint: "fp-dragon",
          hadAssets: true,
          width: 540,
          height: 676,
          thumbnail: null
        } );

        handles.setValue(
          "sketch.render.hueSpeed",
          3
        );
        expect( await registry.execute(
          "gallery.open",
          {
            id: mine.id
          }
        ) ).toEqual( {
          id: mine.id,
          sketch: "p5/voronoi/voronoi-v1-cells",
          opened: false,
          applied: true,
          hadAssets: false
        } );
        expect( document.sketch.render.hueSpeed ).toBe( 1 );
        expect( calls ).toContain( "import" );

        handles.history.canUndo = () => true;
        await expect( registry.execute(
          "gallery.open",
          {
            id: "dragon"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );

        expect( await registry.execute(
          "gallery.open",
          {
            id: "dragon",
            discard: true
          }
        ) ).toEqual( {
          id: "dragon",
          sketch: "threejs/dragon/dragon-corridor",
          opened: true,
          applied: true,
          hadAssets: true
        } );
        expect( calls.slice( -2 ) ).toEqual( [
          "stage",
          "open /sketches/threejs/dragon/dragon-corridor"
        ] );

        await expect( registry.execute(
          "gallery.open",
          {
            id: "nope"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );
  }
);
