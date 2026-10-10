import fs from "fs";
import path from "path";

import {
  buildRelay, RELAY_OUTPUT, RELAY_SOURCE
} from "../relayBuild.ts";
import {
  DEFAULT_PORT, handleMcpMessage, numberedName, originAllowed, parseTabMessage, safeOutputPath, toolContent, type RelayDeps
} from "../studioRelay.ts";

const ROOT = path.resolve(
  __dirname,
  "../../.."
);

describe(
  "the served relay",
  () => {
    it(
      "is the committed build of its source (run npm run mcp:relay:write)",
      () => {
        const built = buildRelay(
          fs.readFileSync(
            path.join(
              ROOT,
              RELAY_SOURCE
            ),
            "utf8"
          ),
          jest.requireActual( "typescript" )
        );

        expect( fs.readFileSync(
          path.join(
            ROOT,
            RELAY_OUTPUT
          ),
          "utf8"
        ) ).toBe( built );
      }
    );

    it(
      "imports nothing but Node's own modules, so it runs without the repository",
      () => {
        const served = fs.readFileSync(
          path.join(
            ROOT,
            RELAY_OUTPUT
          ),
          "utf8"
        );
        const imports = [
          ...served.matchAll( /from\s+"([^"]+)"/g )
        ].map( ( m ) => m[ 1 ] );

        expect( imports.length ).toBeGreaterThan( 0 );
        expect( imports.every( ( name ) => name.startsWith( "node:" ) ) ).toBe( true );
      }
    );
  }
);

describe(
  "who may connect as the tab",
  () => {
    it(
      "admits loopback on any port, the official site and the listed origins",
      () => {
        expect( originAllowed(
          "http://localhost:3000",
          []
        ) ).toBe( true );
        expect( originAllowed(
          "http://127.0.0.1:8080",
          []
        ) ).toBe( true );
        expect( originAllowed(
          "https://p5.steeve.website",
          []
        ) ).toBe( true );
        expect( originAllowed(
          "https://my.sketchbook.example",
          [
            "https://my.sketchbook.example"
          ]
        ) ).toBe( true );
      }
    );

    it(
      "refuses any other site, a lookalike and a request without Origin",
      () => {
        expect( originAllowed(
          "https://evil.example",
          []
        ) ).toBe( false );
        expect( originAllowed(
          "https://p5.steeve.website.evil.example",
          []
        ) ).toBe( false );
        expect( originAllowed(
          "http://localhost.evil.example",
          []
        ) ).toBe( false );
        expect( originAllowed(
          undefined,
          []
        ) ).toBe( false );
      }
    );
  }
);

describe(
  "what the tab sends",
  () => {
    it(
      "parses a hello, a result and an error, and nothing else",
      () => {
        expect( parseTabMessage( JSON.stringify( {
          hello: {
            title: "t",
            route: "/r",
            sketch: "p5/a/b"
          }
        } ) ) ).toEqual( {
          hello: {
            title: "t",
            route: "/r",
            sketch: "p5/a/b"
          }
        } );
        expect( parseTabMessage( JSON.stringify( {
          id: "1",
          ok: true,
          result: {
            a: 1
          }
        } ) ) ).toEqual( {
          id: "1",
          ok: true,
          result: {
            a: 1
          }
        } );
        expect( parseTabMessage( JSON.stringify( {
          id: "2",
          ok: false,
          error: {
            code: "invalid",
            message: "no"
          }
        } ) ) ).toEqual( {
          id: "2",
          ok: false,
          error: {
            code: "invalid",
            message: "no"
          }
        } );
        expect( parseTabMessage( "{" ) ).toBeNull();
        expect( parseTabMessage( JSON.stringify( {
          id: 3,
          ok: true
        } ) ) ).toBeNull();
        expect( parseTabMessage( "[]" ) ).toBeNull();
      }
    );
  }
);

describe(
  "where an exported file may land",
  () => {
    it(
      "takes plain names only, and numbers a taken one",
      () => {
        expect( safeOutputPath(
          "",
          "clip.mp4"
        ) ).toEqual( [
          "clip.mp4"
        ] );
        expect( safeOutputPath(
          "reel/day-1",
          "clip.mp4"
        ) ).toEqual( [
          "reel",
          "day-1",
          "clip.mp4"
        ] );
        expect( safeOutputPath(
          "../x",
          "clip.mp4"
        ) ).toBeNull();
        expect( safeOutputPath(
          "",
          "a/b.mp4"
        ) ).toBeNull();
        expect( safeOutputPath(
          "a//b",
          "c.mp4"
        ) ).toBeNull();
        expect( safeOutputPath(
          "",
          "bad\u0000.mp4"
        ) ).toBeNull();
        expect( numberedName(
          "clip.mp4",
          2
        ) ).toBe( "clip-2.mp4" );
        expect( numberedName(
          "README",
          1
        ) ).toBe( "README-1" );
      }
    );
  }
);

describe(
  "the MCP side",
  () => {
    function deps( overrides: Partial<RelayDeps> = {} ): RelayDeps {
      return {
        port: DEFAULT_PORT,
        outDir: "/out",
        problem: () => null,
        tab: () => ( {
          title: "Voronoi",
          route: "/sketches/p5/voronoi/voronoi-v1-cells",
          sketch: "p5/voronoi/voronoi-v1-cells",
          origin: "http://localhost:3000",
          since: 1
        } ),
        relay: async( request ) => request.kind === "list" ? [
          {
            id: "sketch.set"
          }
        ] : {
          kind: "image",
          mimeType: "image/png",
          data: "QQ==",
          width: 1,
          height: 1,
          note: "frame 0"
        },
        ...overrides
      };
    }

    async function call(
      name: string, args: unknown, d = deps()
    ) {
      return handleMcpMessage(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name,
            arguments: args
          }
        },
        d
      );
    }

    it(
      "initializes and lists its three tools",
      async() => {
        expect( await handleMcpMessage(
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05"
            }
          },
          deps()
        ) )
          .toMatchObject( {
            result: {
              protocolVersion: "2024-11-05",
              serverInfo: {
                name: "sketchbook-studio"
              }
            }
          } );

        const listed = await handleMcpMessage(
          {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list"
          },
          deps()
        );

        expect( ( listed?.result as { tools: { name: string }[] } ).tools.map( ( t ) => t.name ) ).toEqual( [
          "sketchbook_studio_status",
          "sketchbook_studio_commands",
          "sketchbook_studio_run"
        ] );
        expect( await handleMcpMessage(
          {
            jsonrpc: "2.0",
            method: "notifications/initialized"
          },
          deps()
        ) ).toBeNull();
      }
    );

    it(
      "says whether a tab is connected, and how to connect one",
      async() => {
        expect( JSON.parse( ( ( await call(
          "sketchbook_studio_status",
          {}
        ) )?.result as any ).content[ 0 ].text ) ).toMatchObject( {
          connected: true,
          tab: {
            sketch: "p5/voronoi/voronoi-v1-cells"
          },
          port: 7982
        } );
        expect( JSON.parse( ( ( await call(
          "sketchbook_studio_status",
          {},
          deps( {
            tab: () => null
          } )
        ) )?.result as any ).content[ 0 ].text ) ).toMatchObject( {
          connected: false,
          how: expect.stringContaining( "Connect an agent" )
        } );
      }
    );

    it(
      "relays a run and turns an image answer into an image block",
      async() => {
        expect( ( await call(
          "sketchbook_studio_run",
          {
            command: "studio.snapshot"
          }
        ) )?.result ).toEqual( {
          content: [
            {
              type: "image",
              data: "QQ==",
              mimeType: "image/png"
            },
            {
              type: "text",
              text: "frame 0"
            }
          ]
        } );
        expect( toolContent( {
          a: 1
        } ) ).toEqual( [
          {
            type: "text",
            text: "{\n  \"a\": 1\n}"
          }
        ] );
      }
    );

    it(
      "answers a refused command, a missing tab or a busy port as a tool error",
      async() => {
        const refusing = deps( {
          relay: async() => {
            throw new Error( "invalid: \"x\" is 4, above its maximum 3" );
          }
        } );

        expect( ( await call(
          "sketchbook_studio_run",
          {
            command: "sketch.set"
          },
          refusing
        ) )?.result ).toEqual( {
          content: [
            {
              type: "text",
              text: "invalid: \"x\" is 4, above its maximum 3"
            }
          ],
          isError: true
        } );
        expect( ( await call(
          "sketchbook_studio_run",
          {},
          deps()
        ) )?.result ).toMatchObject( {
          isError: true
        } );
        expect( ( await call(
          "sketchbook_studio_commands",
          {},
          deps( {
            problem: () => "unavailable: port taken"
          } )
        ) )?.result ).toEqual( {
          content: [
            {
              type: "text",
              text: "unavailable: port taken"
            }
          ],
          isError: true
        } );
      }
    );
  }
);
