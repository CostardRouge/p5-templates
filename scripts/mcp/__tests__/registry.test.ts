import {
  checkParams, CommandError, createCommandRegistry, paramsJsonSchema, type ParamSpecs
} from "../registry.ts";

const SPECS: ParamSpecs = {
  size: {
    type: "number",
    description: "px",
    min: 50,
    max: 8192,
    integer: true
  },
  format: {
    type: "string",
    description: "kind",
    enum: [
      "png",
      "jpeg"
    ],
    optional: true
  },
  loop: {
    type: "boolean",
    description: "loop",
    optional: true
  },
  tags: {
    type: "strings",
    description: "tags",
    optional: true
  },
  options: {
    type: "object",
    description: "delta",
    optional: true
  }
};

function codeOf( fn: () => unknown ): string | null {
  try {
    fn();
    return null;
  } catch( error ) {
    return error instanceof CommandError ? `${ error.code }: ${ error.message }` : String( error );
  }
}

describe(
  "checkParams",
  () => {
    it(
      "passes declared values through and drops absent optionals",
      () => {
        expect( checkParams(
          SPECS,
          {
            size: 100,
            format: "png"
          }
        ) ).toEqual( {
          size: 100,
          format: "png"
        } );
      }
    );

    it(
      "refuses out of range rather than clamping",
      () => {
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 9000
          }
        ) ) ).toBe( "invalid: \"size\" is 9000, above its maximum 8192" );
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 10
          }
        ) ) ).toBe( "invalid: \"size\" is 10, below its minimum 50" );
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 100.5
          }
        ) ) ).toBe( "invalid: \"size\" must be a whole number" );
      }
    );

    it(
      "refuses an unknown key, naming the known ones",
      () => {
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 100,
            sise: 1
          }
        ) ) ).toBe( "invalid: unknown parameter \"sise\" — this command takes size, format, loop, tags, options" );
        expect( codeOf( () => checkParams(
          undefined,
          {
            a: 1
          }
        ) ) ).toBe( "invalid: unknown parameter \"a\" — this command takes none" );
      }
    );

    it(
      "refuses wrong types, a missing required field and a value outside an enum",
      () => {
        expect( codeOf( () => checkParams(
          SPECS,
          {}
        ) ) ).toBe( "invalid: missing parameter \"size\"" );
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 100,
            format: "gif"
          }
        ) ) ).toBe( "invalid: \"format\" is \"gif\" — one of \"png\", \"jpeg\"" );
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 100,
            loop: "yes"
          }
        ) ) ).toBe( "invalid: \"loop\" must be true or false" );
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 100,
            tags: [
              1
            ]
          }
        ) ) ).toBe( "invalid: \"tags\" must be a list of strings" );
        expect( codeOf( () => checkParams(
          SPECS,
          {
            size: 100,
            options: []
          }
        ) ) ).toBe( "invalid: \"options\" must be an object" );
        expect( codeOf( () => checkParams(
          SPECS,
          []
        ) ) ).toBe( "invalid: params must be an object" );
      }
    );
  }
);

describe(
  "paramsJsonSchema",
  () => {
    it(
      "turns the subset into a closed JSON Schema object",
      () => {
        expect( paramsJsonSchema( SPECS ) ).toEqual( {
          type: "object",
          properties: {
            size: {
              type: "integer",
              minimum: 50,
              maximum: 8192,
              description: "px"
            },
            format: {
              type: "string",
              enum: [
                "png",
                "jpeg"
              ],
              description: "kind"
            },
            loop: {
              type: "boolean",
              description: "loop"
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              },
              description: "tags"
            },
            options: {
              type: "object",
              description: "delta"
            }
          },
          required: [
            "size"
          ],
          additionalProperties: false
        } );
      }
    );
  }
);

describe(
  "createCommandRegistry",
  () => {
    it(
      "lists sorted, with availability and its reason",
      async() => {
        const registry = createCommandRegistry();

        registry.register( [
          {
            id: "b.two",
            title: "Two",
            description: "",
            available: async() => "server down",
            run: () => 2
          },
          {
            id: "a.one",
            title: "One",
            description: "",
            run: () => 1
          }
        ] );

        expect( await registry.list() ).toEqual( [
          {
            id: "a.one",
            title: "One",
            description: "",
            params: {},
            available: true
          },
          {
            id: "b.two",
            title: "Two",
            description: "",
            params: {},
            available: false,
            reason: "server down"
          }
        ] );
      }
    );

    it(
      "codes every way a call can fail",
      async() => {
        const registry = createCommandRegistry();

        registry.register( [
          {
            id: "x.down",
            title: "",
            description: "",
            available: () => "no server",
            run: () => 0
          },
          {
            id: "x.boom",
            title: "",
            description: "",
            run: () => {
              throw new Error( "kaput" );
            }
          },
          {
            id: "x.echo",
            title: "",
            description: "",
            params: {
              n: {
                type: "number",
                description: "",
                max: 1
              }
            },
            run: ( p ) => p.n
          }
        ] );

        await expect( registry.execute( "x.nope" ) ).rejects.toMatchObject( {
          code: "unknown",
          message: "no command \"x.nope\" — in that group: x.boom, x.down, x.echo"
        } );
        await expect( registry.execute( "x.down" ) ).rejects.toMatchObject( {
          code: "unavailable",
          message: "no server"
        } );
        await expect( registry.execute(
          "x.echo",
          {
            n: 2
          }
        ) ).rejects.toMatchObject( {
          code: "invalid"
        } );
        await expect( registry.execute( "x.boom" ) ).rejects.toMatchObject( {
          code: "failed",
          message: "kaput"
        } );
        await expect( registry.execute(
          "x.echo",
          {
            n: 1
          }
        ) ).resolves.toBe( 1 );
      }
    );

    it(
      "takes its commands back on unregister",
      async() => {
        const registry = createCommandRegistry();
        const off = registry.register( [
          {
            id: "a.one",
            title: "",
            description: "",
            run: () => 1
          }
        ] );

        off();
        expect( await registry.list() ).toEqual( [] );
      }
    );
  }
);
