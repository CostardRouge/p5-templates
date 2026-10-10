import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  sketchCommands
} from "../commands/sketchCommands";
import {
  leafWrites
} from "../handles";
import {
  fakeHandles
} from "./fakeHandles";

function setup( document: Record<string, any> ) {
  const fake = fakeHandles( document );
  const registry = createCommandRegistry();

  registry.register( sketchCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "sketch commands",
  () => {
    it(
      "write a parameter delta leaf by leaf, as the controls do, on the root or a slide",
      async() => {
        const {
          registry, writes, setActive
        } = setup( {
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "rainbow"
            }
          },
          slides: [
            {
              sketch: {
                render: {
                  hueSpeed: 1,
                  palette: "rainbow"
                }
              }
            }
          ]
        } );

        await expect( registry.execute(
          "sketch.set",
          {
            values: {
              render: {
                palette: "sunset",
                hueSpeed: 2
              }
            }
          }
        ) ).resolves.toEqual( {
          scope: "the root",
          written: [
            "sketch.render.palette",
            "sketch.render.hueSpeed"
          ]
        } );
        setActive( 0 );
        await registry.execute(
          "sketch.set",
          {
            values: {
              render: {
                hueSpeed: 3
              }
            }
          }
        );
        expect( writes.at( -1 ) ).toEqual( [
          "slides.0.sketch.render.hueSpeed",
          3
        ] );
      }
    );

    it(
      "refuse what the control would refuse, and a slide that does not exist",
      async() => {
        const {
          registry, writes
        } = setup( {
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "rainbow"
            }
          }
        } );

        await expect( registry.execute(
          "sketch.set",
          {
            values: {
              render: {
                hueSpeed: 9
              }
            }
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "options.render.hueSpeed is 9, above its maximum 3"
        } );
        await expect( registry.execute(
          "sketch.set",
          {
            values: {},
            slide: 2
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "this piece has no slides — slides.add makes one"
        } );
        expect( writes ).toEqual( [] );
      }
    );

    it(
      "set the canvas and clock on the right scope, and need at least one of them",
      async() => {
        const {
          registry, writes, setActive
        } = setup( {
          size: {
            width: 1080,
            height: 1350
          },
          slides: [
            {}
          ]
        } );

        await registry.execute(
          "canvas.set",
          {
            width: 1080,
            height: 1920,
            duration: 6
          }
        );
        setActive( 0 );
        await registry.execute(
          "canvas.set",
          {
            framerate: 30
          }
        );
        expect( writes ).toEqual( [
          [
            "size.width",
            1080
          ],
          [
            "size.height",
            1920
          ],
          [
            "animation.duration",
            6
          ],
          [
            "slides.0.animation.framerate",
            30
          ]
        ] );
        await expect( registry.execute(
          "canvas.set",
          {}
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        await expect( registry.execute(
          "canvas.set",
          {
            width: 20
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "seek by time through the page's clock, pausing first, and refuse past the loop",
      async() => {
        const {
          registry, calls
        } = setup( {} );

        await expect( registry.execute(
          "playback.seek",
          {
            time: 3
          }
        ) ).resolves.toEqual( {
          playing: false,
          progress: 0.25
        } );
        expect( calls ).toEqual( [
          "pause",
          "seek 0.25"
        ] );
        await expect( registry.execute(
          "playback.seek",
          {
            time: 20
          }
        ) ).rejects.toMatchObject( {
          message: "time 20 s is past the end — the loop is 12 s"
        } );
        await expect( registry.execute(
          "playback.seek",
          {
            time: 1,
            progress: 0.1
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );

    it(
      "answer a snapshot as an image, saved through the relay when asked",
      async() => {
        const {
          registry
        } = setup( {} );
        const image = await registry.execute(
          "studio.snapshot",
          {
            maxEdge: 300,
            save: true
          }
        ) as Record<string, string>;

        expect( image ).toMatchObject( {
          kind: "image",
          mimeType: "image/jpeg",
          width: 300
        } );
        expect( image.note ).toMatch( /^p5\/voronoi\/voronoi-v1-cells, at 25\.0 % of the loop\. Saved full size to \/out\/voronoi-v1-cells-.*\.png\.$/ );
      }
    );

    it(
      "reset, randomize and undo through the studio's own handlers",
      async() => {
        const {
          registry, writes, calls
        } = setup( {
          sketch: {
            render: {
              hueSpeed: 2
            }
          }
        } );

        await registry.execute(
          "sketch.reset",
          {}
        );
        await registry.execute(
          "sketch.randomize",
          {}
        );
        await registry.execute(
          "history.undo",
          {}
        );
        expect( writes ).toEqual( [
          [
            "sketch",
            {
              render: {
                hueSpeed: 0,
                palette: "rainbow"
              }
            }
          ]
        ] );
        expect( calls ).toEqual( [
          "randomize sketch",
          "undo"
        ] );
      }
    );
  }
);

describe(
  "leafWrites",
  () => {
    it(
      "splits objects to their leaves and keeps arrays whole",
      () => {
        expect( leafWrites(
          "sketch",
          {
            a: {
              b: 1,
              c: [
                1,
                2
              ]
            },
            d: "x",
            e: {}
          }
        ) ).toEqual( [
          [
            "sketch.a.b",
            1
          ],
          [
            "sketch.a.c",
            [
              1,
              2
            ]
          ],
          [
            "sketch.d",
            "x"
          ],
          [
            "sketch.e",
            {}
          ]
        ] );
      }
    );
  }
);
