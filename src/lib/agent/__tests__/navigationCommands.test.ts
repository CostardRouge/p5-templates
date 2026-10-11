import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  navigationCommands
} from "../commands/navigationCommands";
import {
  fakeHandles
} from "./fakeHandles";

function setup( canUndo: boolean ) {
  const fake = fakeHandles( {} );

  fake.handles.history.canUndo = () => canUndo;

  const registry = createCommandRegistry();

  registry.register( navigationCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "navigation commands",
  () => {
    it(
      "list the gallery, hidden sketches only on request",
      async() => {
        const {
          registry
        } = setup( false );

        expect( await registry.execute(
          "sketches.list",
          {
            query: "VORONOI"
          }
        ) ).toMatchObject( {
          count: 1,
          sketches: [
            {
              id: "p5/voronoi/voronoi-v1-cells"
            }
          ]
        } );
        expect( ( await registry.execute(
          "sketches.list",
          {
            includeHidden: true
          }
        ) as { count: number } ).count ).toBe( 3 );
      }
    );

    it(
      "find a sketch by its description or a tag, and count what is described",
      async() => {
        const {
          registry
        } = setup( false );

        expect( await registry.execute(
          "sketches.list",
          {
            query: "coloured cells"
          }
        ) ).toEqual( {
          count: 1,
          described: 1,
          current: "p5/voronoi/voronoi-v1-cells",
          tags: {
            geometry: 1,
            "flat-colour": 1
          },
          sketches: [
            {
              id: "p5/voronoi/voronoi-v1-cells",
              description: "Coloured cells drifting.",
              tags: [
                "geometry",
                "flat-colour"
              ]
            }
          ]
        } );
        expect( await registry.execute(
          "sketches.list",
          {
            tag: "geometry"
          }
        ) ).toMatchObject( {
          count: 1
        } );
        await expect( registry.execute(
          "sketches.list",
          {
            tag: "letters"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "no sketch carries the tag \"letters\" — tags in use: flat-colour, geometry"
        } );
      }
    );

    it(
      "open a sketch and wait for it, never leaving changes behind unasked",
      async() => {
        const {
          registry, calls
        } = setup( true );

        await expect( registry.execute(
          "studio.open",
          {
            sketch: "p5/voronoi/voronoi"
          }
        ) ).rejects.toMatchObject( {
          message: "no sketch \"p5/voronoi/voronoi\" — did you mean p5/voronoi/voronoi-v1-cells, p5/voronoi/voronoi-v2-draft?"
        } );
        await expect( registry.execute(
          "studio.open",
          {
            sketch: "threejs/dragon/dragon-corridor"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        expect( await registry.execute(
          "studio.open",
          {
            sketch: "threejs/dragon/dragon-corridor",
            discard: true
          }
        ) ).toEqual( {
          sketch: "threejs/dragon/dragon-corridor",
          opened: true
        } );
        expect( calls ).toEqual( [
          "open /sketches/threejs/dragon/dragon-corridor"
        ] );
      }
    );
  }
);
