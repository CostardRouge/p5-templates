import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  contentCommands, parseItemPath
} from "../commands/contentCommands";
import {
  fakeHandles
} from "./fakeHandles";

function setup(
  document: Record<string, any>, validate?: ( doc: any ) => { issues: { path: string;
    message: string }[];
  normalized: Record<string, unknown> | null }
) {
  const fake = fakeHandles(
    document,
    validate ? {
      validateDocument: validate
    } : {}
  );
  const registry = createCommandRegistry();

  registry.register( contentCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "content commands",
  () => {
    it(
      "add an item built by the rail's factory to the active slide, or the root",
      async() => {
        const {
          registry, document, calls, setActive
        } = setup( {
          content: [],
          slides: [
            {
              content: []
            }
          ]
        } );

        await expect( registry.execute(
          "content.add",
          {
            kind: "text",
            fields: {
              content: "HELLO"
            },
            scope: "global"
          }
        ) ).resolves.toMatchObject( {
          path: "content.0",
          item: {
            type: "text",
            content: "HELLO"
          }
        } );
        setActive( 0 );
        await expect( registry.execute(
          "content.add",
          {
            kind: "image",
            fields: {
              source: "global/images/a.jpg"
            }
          }
        ) ).resolves.toMatchObject( {
          path: "slides.0.content.0"
        } );
        expect( document.slides[ 0 ].content[ 0 ] ).toMatchObject( {
          type: "image",
          source: "global/images/a.jpg"
        } );
        expect( calls ).toEqual( [
          "selectPath content.0",
          "selectPath slides.0.content.0"
        ] );
      }
    );

    it(
      "refuse a field the schema refuses or would drop, and fields.type",
      async() => {
        const {
          registry, document
        } = setup(
          {
            content: []
          },
          ( doc ) => "text" in doc.content[ 0 ]
            ? {
              issues: [
                {
                  path: "content.0.text",
                  message: "Unknown key, not part of the options schema — known here: type, content"
                }
              ],
              normalized: null
            }
            : {
              issues: [],
              normalized: doc
            }
        );

        await expect( registry.execute(
          "content.add",
          {
            kind: "text",
            fields: {
              text: "hi"
            }
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "this text does not fit its schema — text: Unknown key, not part of the options schema — known here: type, content"
        } );
        await expect( registry.execute(
          "content.add",
          {
            kind: "text",
            fields: {
              type: "image"
            }
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        expect( document.content ).toEqual( [] );
      }
    );

    it(
      "seed a sketch layer with that sketch's own defaults",
      async() => {
        const {
          registry
        } = setup( {
          content: []
        } );

        await expect( registry.execute(
          "content.add",
          {
            kind: "sketch",
            fields: {
              sketch: "noise/noise-v1"
            }
          }
        ) ).resolves.toMatchObject( {
          item: {
            type: "sketch",
            sketch: "noise/noise-v1",
            settings: {
              amount: 1
            }
          }
        } );
        await expect( registry.execute(
          "content.add",
          {
            kind: "sketch",
            fields: {}
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        await expect( registry.execute(
          "content.add",
          {
            kind: "sketch",
            fields: {
              sketch: "nope"
            }
          }
        ) ).rejects.toMatchObject( {
          code: "failed"
        } );
      }
    );

    it(
      "change, toggle, place, reorder, duplicate and remove by path",
      async() => {
        const {
          registry, document, writes
        } = setup( {
          content: [
            {
              type: "text",
              content: "A",
              enabled: true,
              position: {
                x: 0,
                y: 0
              }
            },
            {
              type: "hud-gauge",
              enabled: true,
              offset: {
                x: 0.1,
                y: 0.1
              }
            },
            {
              type: "background"
            }
          ]
        } );

        await registry.execute(
          "content.update",
          {
            path: "content.0",
            fields: {
              content: "B",
              size: 80
            }
          }
        );
        await registry.execute(
          "content.toggle",
          {
            path: "content.1",
            enabled: false
          }
        );
        await expect( registry.execute(
          "content.place",
          {
            path: "content.0",
            x: 0.5,
            y: 0.8
          }
        ) ).rejects.toMatchObject( {
          code: "unavailable"
        } );
        await registry.execute(
          "content.place",
          {
            path: "content.0",
            x: 0.5,
            y: 0.8,
            by: "field"
          }
        );
        await registry.execute(
          "content.place",
          {
            path: "content.1",
            x: 0.9,
            y: 0.1
          }
        );
        expect( writes ).toEqual( [
          [
            "content.0.content",
            "B"
          ],
          [
            "content.0.size",
            80
          ],
          [
            "content.1.enabled",
            false
          ],
          [
            "content.0.position",
            {
              x: 0.5,
              y: 0.8
            }
          ],
          [
            "content.1.offset",
            {
              // Drawn centre (0.2, 0.15) moved onto (0.9, 0.1).
              x: 0.8,
              y: 0.05
            }
          ]
        ] );
        await expect( registry.execute(
          "content.place",
          {
            // Offset 0.05 − drawn centre 0.15: the top is out of reach.
            path: "content.1",
            x: 0.5,
            y: 0
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        await expect( registry.execute(
          "content.place",
          {
            path: "content.2",
            x: 0.5,
            y: 0.5
          }
        ) ).rejects.toMatchObject( {
          message: "a background item is not placed by hand"
        } );
        await expect( registry.execute(
          "content.toggle",
          {
            path: "content.2",
            enabled: true
          }
        ) ).rejects.toMatchObject( {
          message: "a background item has no show/hide switch"
        } );

        await registry.execute(
          "content.move",
          {
            path: "content.2",
            to: 0
          }
        );
        expect( document.content.map( ( item: any ) => item.type ) ).toEqual( [
          "background",
          "text",
          "hud-gauge"
        ] );
        await registry.execute(
          "content.duplicate",
          {
            path: "content.1"
          }
        );
        expect( document.content.map( ( item: any ) => item.type ) ).toEqual( [
          "background",
          "text",
          "text",
          "hud-gauge"
        ] );
        await registry.execute(
          "content.remove",
          {
            path: "content.0"
          }
        );
        expect( document.content.map( ( item: any ) => item.type ) ).toEqual( [
          "text",
          "text",
          "hud-gauge"
        ] );
        await expect( registry.execute(
          "content.remove",
          {
            path: "content.9"
          }
        ) ).rejects.toMatchObject( {
          message: "no item at content.9 — content holds 3"
        } );
      }
    );

    it(
      "list the root's and every slide's items with their paths",
      async() => {
        const {
          registry
        } = setup( {
          content: [
            {
              type: "text",
              content: "A",
              enabled: true
            }
          ],
          slides: [
            {
              content: [
                {
                  type: "image",
                  source: "x.jpg"
                }
              ]
            }
          ]
        } );

        await expect( registry.execute(
          "content.list",
          {}
        ) ).resolves.toEqual( {
          global: [
            {
              path: "content.0",
              type: "text",
              enabled: true,
              label: "A"
            }
          ],
          slides: [
            [
              {
                path: "slides.0.content.0",
                type: "image",
                label: "x.jpg"
              }
            ]
          ],
          activeSlide: null
        } );
      }
    );

    it(
      "add a HUD widget bound to a parameter, through the quick-add",
      async() => {
        const {
          registry, calls
        } = setup( {
          content: []
        } );

        await expect( registry.execute(
          "content.hudFor",
          {
            control: "render.hueSpeed"
          }
        ) ).resolves.toEqual( {
          path: "content.0",
          kind: "hud-counter",
          allowed: [
            "hud-counter",
            "hud-gauge",
            "hud-sparkline"
          ]
        } );
        expect( calls ).toEqual( [
          "hud sketch.render.hueSpeed hud-counter"
        ] );
        await expect( registry.execute(
          "content.hudFor",
          {
            control: "render.hueSpeed",
            kind: "hud-swatch"
          }
        ) ).rejects.toMatchObject( {
          message: "\"render.hueSpeed\" takes hud-counter, hud-gauge, hud-sparkline, not hud-swatch"
        } );
        await expect( registry.execute(
          "content.hudFor",
          {
            control: "render.palette"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
      }
    );
  }
);

describe(
  "parseItemPath",
  () => {
    it(
      "reads a root or slide item path and refuses anything else",
      () => {
        expect( parseItemPath( "content.3" ) ).toEqual( {
          list: "content",
          index: 3
        } );
        expect( parseItemPath( "slides.2.content.0" ) ).toEqual( {
          list: "slides.2.content",
          index: 0
        } );
        expect( () => parseItemPath( "sketch.render" ) ).toThrow( /is not a content item path/ );
      }
    );
  }
);
