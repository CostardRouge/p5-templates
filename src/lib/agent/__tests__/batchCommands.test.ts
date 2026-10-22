import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  batchCommands
} from "../commands/batchCommands";
import {
  sketchCommands
} from "../commands/sketchCommands";
import {
  withTransactions
} from "../transaction";
import {
  fakeHandles
} from "./fakeHandles";

function setup( document: Record<string, any> ) {
  const fake = fakeHandles( document );
  const registry = createCommandRegistry();

  registry.register( withTransactions(
    [
      ...sketchCommands( fake.handles ),
      ...batchCommands( registry )
    ],
    fake.handles
  ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "transactions and studio.batch",
  () => {
    it(
      "wrap every command's run in one transaction named after it, but the ungrouped ones",
      async() => {
        const {
          registry, calls
        } = setup( {
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "rainbow"
            }
          }
        } );

        await registry.execute(
          "sketch.set",
          {
            values: {
              render: {
                hueSpeed: 1
              }
            }
          }
        );
        expect( calls ).toEqual( [
          "begin sketch.set",
          "end sketch.set"
        ] );
        calls.length = 0;
        await registry.execute( "history.undo" );
        expect( calls ).toEqual( [
          "undo"
        ] );
        // A refused call never opens a transaction: params are checked first.
        calls.length = 0;
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
          code: "invalid"
        } );
        expect( calls ).toEqual( [
          "begin sketch.set",
          "end sketch.set"
        ] );
      }
    );

    it(
      "run steps in order inside ONE transaction, and replace a picture by its note",
      async() => {
        const {
          registry, calls, document
        } = setup( {
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "rainbow"
            }
          },
          size: {
            width: 1080,
            height: 1350
          }
        } );

        const result = await registry.execute(
          "studio.batch",
          {
            steps: [
              {
                command: "sketch.set",
                params: {
                  values: {
                    render: {
                      palette: "sunset"
                    }
                  }
                }
              },
              {
                command: "canvas.set",
                params: {
                  width: 1080,
                  height: 1080
                }
              },
              {
                command: "studio.snapshot"
              }
            ]
          }
        );

        expect( result ).toMatchObject( {
          applied: 3,
          steps: [
            {
              command: "sketch.set",
              result: {
                written: [
                  "sketch.render.palette"
                ]
              }
            },
            {
              command: "canvas.set",
              result: {
                written: [
                  "size.width",
                  "size.height"
                ]
              }
            },
            {
              command: "studio.snapshot",
              result: {
                kind: "image"
              }
            }
          ]
        } );
        expect( ( result as any ).steps[ 2 ].result.data ).toBeUndefined();
        expect( document.sketch.render.palette ).toBe( "sunset" );
        expect( document.size.height ).toBe( 1080 );
        // The outer transaction is the batch's; the steps nest inside it.
        expect( calls.filter( ( call ) => /^(begin|end)/.test( call ) ) ).toEqual( [
          "begin studio.batch",
          "begin sketch.set",
          "end sketch.set",
          "begin canvas.set",
          "end canvas.set",
          "begin studio.snapshot",
          "end studio.snapshot",
          "end studio.batch"
        ] );
      }
    );

    it(
      "stop at the first failing step, keep what came before, and say so",
      async() => {
        const {
          registry, document
        } = setup( {
          sketch: {
            render: {
              hueSpeed: 0,
              palette: "rainbow"
            }
          }
        } );

        await expect( registry.execute(
          "studio.batch",
          {
            steps: [
              {
                command: "sketch.set",
                params: {
                  values: {
                    render: {
                      hueSpeed: 2
                    }
                  }
                }
              },
              {
                command: "sketch.set",
                params: {
                  values: {
                    render: {
                      hueSpeed: 9
                    }
                  }
                }
              },
              {
                command: "sketch.reset"
              }
            ]
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "step 1 (sketch.set): options.render.hueSpeed is 9, above its maximum 3 — steps 0 to 0 were applied and are one undo step; steps 2 to 2 did not run"
        } );
        expect( document.sketch.render.hueSpeed ).toBe( 2 );
      }
    );

    it(
      "refuse a malformed step list and the commands that cannot be steps",
      async() => {
        const {
          registry
        } = setup( {
          sketch: {}
        } );

        await expect( registry.execute(
          "studio.batch",
          {
            steps: []
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "steps is empty — give at least one { command, params }"
        } );
        await expect( registry.execute(
          "studio.batch",
          {
            steps: [
              {
                params: {}
              }
            ]
          }
        ) ).rejects.toMatchObject( {
          message: "step 0 has no \"command\" — each step is { command, params }"
        } );
        await expect( registry.execute(
          "studio.batch",
          {
            steps: [
              {
                command: "sketch.set",
                values: {}
              }
            ]
          }
        ) ).rejects.toMatchObject( {
          message: "step 0 has an unknown key \"values\" — each step is { command, params }"
        } );
        for ( const command of [
          "studio.batch",
          "studio.open",
          "export.run",
          "history.undo"
        ] ) {
          await expect( registry.execute(
            "studio.batch",
            {
              steps: [
                {
                  command
                }
              ]
            }
          ) ).rejects.toMatchObject( {
            message: `step 0: ${ command } cannot run inside a batch — call it on its own`
          } );
        }
        await expect( registry.execute(
          "studio.batch",
          {
            steps: [
              {
                command: "sketch.nothing"
              }
            ]
          }
        ) ).rejects.toMatchObject( {
          code: "unknown",
          message: expect.stringContaining( "step 0 (sketch.nothing): no command \"sketch.nothing\"" )
        } );
      }
    );
  }
);
