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
            "p5/voronoi/voronoi-v1-cells"
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
