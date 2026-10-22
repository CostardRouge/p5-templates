import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  exportCommands
} from "../commands/exportCommands";
import {
  fakeHandles
} from "./fakeHandles";

function setup( overrides = {} ) {
  const fake = fakeHandles(
    {},
    overrides
  );
  const registry = createCommandRegistry();

  registry.register( exportCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "export commands",
  () => {
    it(
      "edit the dialog's variant list, refusing what the runner would bend",
      async() => {
        const {
          registry, handles
        } = setup();

        expect( await registry.execute(
          "export.add",
          {
            preset: "square",
            format: "webm",
            framerate: 24
          }
        ) ).toMatchObject( {
          id: "v1",
          format: "webm",
          framerate: 24,
          size: {
            width: 1080,
            height: 1080
          }
        } );
        await expect( registry.execute(
          "export.add",
          {
            preset: "tiktok"
          }
        ) ).rejects.toMatchObject( {
          message: "no preset \"tiktok\" — square, still"
        } );
        await expect( registry.execute(
          "export.update",
          {
            id: "v1",
            framerate: 60
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "framerate 60 is above the sketch's own 30 fps — a capture cannot add frames the sketch does not draw"
        } );
        await expect( registry.execute(
          "export.update",
          {
            id: "v1",
            width: 720
          }
        ) ).rejects.toMatchObject( {
          message: "give width and height together"
        } );
        await registry.execute(
          "export.update",
          {
            id: "v1",
            width: 720,
            height: 1280,
            kind: "frames",
            allFrames: true
          }
        );
        expect( handles.exports.list()[ 0 ] ).toMatchObject( {
          size: {
            width: 720,
            height: 1280
          },
          kind: "frames",
          frameCount: "all"
        } );
        await expect( registry.execute(
          "export.remove",
          {
            id: "nope"
          }
        ) ).rejects.toMatchObject( {
          message: "no variant \"nope\" — v1 (Square)"
        } );
      }
    );

    it(
      "run the list or a one-off variant, every file written by the relay",
      async() => {
        const {
          registry, calls, handles
        } = setup();

        await expect( registry.execute(
          "export.run",
          {}
        ) ).rejects.toMatchObject( {
          message: "the Export list is empty — export.add a variant, or give a preset"
        } );
        await expect( registry.execute(
          "export.run",
          {
            format: "gif"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        expect( await registry.execute(
          "export.run",
          {
            preset: "still",
            folder: "agent"
          }
        ) ).toEqual( {
          variants: [
            {
              variant: "Still image",
              status: "done"
            }
          ],
          files: [
            {
              variant: "Still image",
              path: "/out/Still image.png",
              bytes: 3
            }
          ]
        } );
        // A one-off joins no list.
        expect( handles.exports.list() ).toEqual( [] );

        await registry.execute(
          "export.add",
          {
            preset: "square"
          }
        );
        await registry.execute(
          "export.run",
          {}
        );
        expect( calls ).toEqual( [
          "export Still image",
          "export Square"
        ] );
      }
    );

    it(
      "is unavailable without a relay to write to",
      async() => {
        const {
          registry
        } = setup( {
          relayConnected: () => false
        } );

        await expect( registry.execute(
          "export.run",
          {
            preset: "still"
          }
        ) ).rejects.toMatchObject( {
          code: "unavailable",
          message: "the relay is not connected — files would have nowhere to go"
        } );
      }
    );
  }
);
