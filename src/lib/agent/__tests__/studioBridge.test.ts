import {
  CommandError, createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  answerRelay
} from "../studioBridge";

describe(
  "answerRelay",
  () => {
    const registry = createCommandRegistry();

    registry.register( [
      {
        id: "sketch.set",
        title: "Set",
        description: "set",
        params: {
          n: {
            type: "number",
            description: "n",
            max: 3
          }
        },
        run: ( params ) => ( {
          n: params.n
        } )
      },
      {
        id: "export.run",
        title: "Export",
        description: "",
        available: () => "no relay",
        run: () => null
      },
      {
        id: "x.boom",
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

    it(
      "lists commands with their JSON Schema and availability",
      async() => {
        const answer = await answerRelay(
          registry,
          {
            id: "1",
            kind: "list"
          }
        );

        expect( answer ).toMatchObject( {
          id: "1",
          ok: true
        } );
        expect( ( answer as { result: unknown[] } ).result ).toEqual( [
          {
            id: "export.run",
            title: "Export",
            description: "",
            params: {
              type: "object",
              properties: {},
              additionalProperties: false
            },
            available: false,
            reason: "no relay"
          },
          {
            id: "sketch.set",
            title: "Set",
            description: "set",
            params: {
              type: "object",
              properties: {
                n: {
                  type: "number",
                  maximum: 3,
                  description: "n"
                }
              },
              required: [
                "n"
              ],
              additionalProperties: false
            },
            available: true
          },
          {
            id: "x.boom",
            title: "",
            description: "",
            params: {
              type: "object",
              properties: {},
              additionalProperties: false
            },
            available: true
          }
        ] );
      }
    );

    it(
      "runs a command and answers its result, or its coded refusal",
      async() => {
        expect( await answerRelay(
          registry,
          {
            id: "2",
            kind: "run",
            command: "sketch.set",
            params: {
              n: 2
            }
          }
        ) ).toEqual( {
          id: "2",
          ok: true,
          result: {
            n: 2
          }
        } );
        expect( await answerRelay(
          registry,
          {
            id: "3",
            kind: "run",
            command: "sketch.set",
            params: {
              n: 9
            }
          }
        ) ).toEqual( {
          id: "3",
          ok: false,
          error: {
            code: "invalid",
            message: "\"n\" is 9, above its maximum 3"
          }
        } );
        expect( await answerRelay(
          registry,
          {
            id: "4",
            kind: "run",
            command: "x.boom"
          }
        ) ).toMatchObject( {
          ok: false,
          error: {
            code: "failed",
            message: "kaput"
          }
        } );
        expect( await answerRelay(
          registry,
          {
            id: "5",
            kind: "run",
            command: "nope.nope"
          }
        ) ).toMatchObject( {
          ok: false,
          error: {
            code: "unknown"
          }
        } );
      }
    );
  }
);
