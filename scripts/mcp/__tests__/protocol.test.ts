import {
  handleMessage, toToolResult
} from "../protocol.ts";
import {
  CommandError, createCommandRegistry
} from "../registry.ts";

function registry() {
  const commands = createCommandRegistry();

  commands.register( [
    {
      id: "app.status",
      title: "Status",
      description: "where",
      run: () => ( {
        reachable: true
      } )
    },
    {
      id: "render.frame",
      title: "Frame",
      description: "look",
      params: {
        n: {
          type: "number",
          description: "n",
          max: 2
        }
      },
      run: () => ( {
        kind: "image",
        mimeType: "image/jpeg",
        data: "QUJD",
        width: 4,
        height: 5,
        note: "frame 0"
      } )
    },
    {
      id: "jobs.get",
      title: "Job",
      description: "",
      available: () => "no server",
      run: () => null
    },
    {
      id: "x.throw",
      title: "",
      description: "",
      run: () => {
        throw new CommandError(
          "failed",
          "kaput"
        );
      }
    }
  ] );

  return commands;
}

async function call(
  name: string, args?: unknown
) {
  return handleMessage(
    registry(),
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    }
  );
}

describe(
  "the MCP protocol",
  () => {
    it(
      "initializes, echoing a protocol version it speaks",
      async() => {
        const answer = await handleMessage(
          registry(),
          {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-03-26"
            }
          }
        );

        expect( answer ).toMatchObject( {
          id: 1,
          result: {
            protocolVersion: "2025-03-26",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "sketchbook"
            }
          }
        } );

        const unknown = await handleMessage(
          registry(),
          {
            jsonrpc: "2.0",
            id: 2,
            method: "initialize",
            params: {
              protocolVersion: "1999-01-01"
            }
          }
        );

        expect( ( unknown?.result as Record<string, unknown> ).protocolVersion ).toBe( "2025-06-18" );
      }
    );

    it(
      "answers nothing to a notification, and method-not-found to an unknown request",
      async() => {
        expect( await handleMessage(
          registry(),
          {
            jsonrpc: "2.0",
            method: "notifications/initialized"
          }
        ) ).toBeNull();
        expect( await handleMessage(
          registry(),
          {
            jsonrpc: "2.0",
            id: 3,
            method: "resources/list"
          }
        ) ).toMatchObject( {
          id: 3,
          error: {
            code: -32601
          }
        } );
      }
    );

    it(
      "lists the three generic tools",
      async() => {
        const answer = await handleMessage(
          registry(),
          {
            jsonrpc: "2.0",
            id: 4,
            method: "tools/list"
          }
        );

        expect( ( answer?.result as { tools: { name: string }[] } ).tools.map( ( t ) => t.name ) ).toEqual( [
          "sketchbook_status",
          "sketchbook_commands",
          "sketchbook_run"
        ] );
      }
    );

    it(
      "lists commands with JSON Schema params and availability",
      async() => {
        const answer = await call( "sketchbook_commands" );
        const listed = JSON.parse( ( answer?.result as { content: { text: string }[] } ).content[ 0 ].text );

        expect( listed.find( ( c: { id: string } ) => c.id === "render.frame" ).params ).toEqual( {
          type: "object",
          properties: {
            n: {
              type: "number",
              maximum: 2,
              description: "n"
            }
          },
          required: [
            "n"
          ],
          additionalProperties: false
        } );
        expect( listed.find( ( c: { id: string } ) => c.id === "jobs.get" ) ).toMatchObject( {
          available: false,
          reason: "no server"
        } );
      }
    );

    it(
      "runs a command, turning an image answer into an image block beside its note",
      async() => {
        const answer = await call(
          "sketchbook_run",
          {
            command: "render.frame",
            params: {
              n: 1
            }
          }
        );

        expect( answer?.result ).toEqual( {
          content: [
            {
              type: "image",
              data: "QUJD",
              mimeType: "image/jpeg"
            },
            {
              type: "text",
              text: "frame 0"
            }
          ]
        } );
      }
    );

    it(
      "reports a refused or failed command as a tool error with its code",
      async() => {
        expect( await call(
          "sketchbook_run",
          {
            command: "render.frame",
            params: {
              n: 3
            }
          }
        ) ).toMatchObject( {
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: "invalid: \"n\" is 3, above its maximum 2"
              }
            ]
          }
        } );
        expect( await call(
          "sketchbook_run",
          {
            command: "jobs.get"
          }
        ) ).toMatchObject( {
          result: {
            isError: true,
            content: [
              {
                text: "unavailable: no server"
              }
            ]
          }
        } );
        expect( await call(
          "sketchbook_run",
          {
            command: "x.throw"
          }
        ) ).toMatchObject( {
          result: {
            isError: true,
            content: [
              {
                text: "failed: kaput"
              }
            ]
          }
        } );
        expect( await call(
          "sketchbook_run",
          {}
        ) ).toMatchObject( {
          result: {
            isError: true
          }
        } );
        expect( await call( "nope" ) ).toMatchObject( {
          result: {
            isError: true,
            content: [
              {
                text: expect.stringMatching( /^unknown: no tool "nope"/ )
              }
            ]
          }
        } );
      }
    );

    it(
      "passes plain answers through as JSON text",
      () => {
        expect( toToolResult( {
          a: 1
        } ) ).toEqual( {
          content: [
            {
              type: "text",
              text: "{\n  \"a\": 1\n}"
            }
          ]
        } );
      }
    );
  }
);
