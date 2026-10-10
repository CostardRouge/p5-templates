/**
 * The COMMAND REGISTRY: everything an agent or a script may ask Sketchbook to
 * do, named once — an id, its parameters, whether it can run now and what it
 * does — and run through ONE door, `execute`.
 *
 * Same shapes as Atelier's `src/shared/commands/registry.ts` (and Winnow's),
 * on purpose: an agent driving any of the three meets the same command
 * listing, the same parameter subset, the same error codes and the same image
 * result. The idea is LightCraft's (`storytold/lightcraft`): every gesture is a
 * command with a stable dotted id and JSON parameters. Two differences, both
 * because the commands here talk to a server over HTTP rather than to a mounted
 * screen: `available()` may be async, and there is no per-screen registration
 * stack to wait on.
 *
 * Parameters are a small typed subset (number with bounds, string with an
 * optional enum, boolean, list of strings, free object), checked here before
 * `run` sees them. Out of range is REFUSED, never clamped, and an unknown field
 * is refused naming the known ones — a misspelt key that silently did nothing
 * is the hardest failure for an agent to notice.
 *
 * Pure: no I/O, no Node or DOM API.
 */

/** One parameter's shape. */
export type ParamSpec =
  | { type: "number";
    description: string;
    min?: number;
    max?: number;
    integer?: boolean;
    optional?: boolean }
  | { type: "string";
    description: string;
    enum?: readonly string[];
    optional?: boolean }
  | { type: "boolean";
    description: string;
    optional?: boolean }
  | { type: "strings";
    description: string;
    optional?: boolean }
  | { type: "object";
    description: string;
    optional?: boolean };

export type ParamSpecs = Readonly<Record<string, ParamSpec>>;

/** What a command may answer with besides plain JSON: a picture to LOOK at. */
export interface ImageResult {
  kind: "image";
  mimeType: "image/jpeg" | "image/png";
  /** Base64, no `data:` prefix. */
  data: string;
  width: number;
  height: number;
  /** What the picture is — said beside it to the agent. */
  note?: string;
}

export type Availability = true | string;

export interface CommandSpec {
  /** Dotted and stable: `sketches.list`, `render.frame`. A script outlives a label. */
  id: string;
  /** A few words for a person. */
  title: string;
  /** What it does and what it answers, for the agent choosing it. */
  description: string;
  params?: ParamSpecs;
  /** `true` when it can run now, else the reason it cannot. Absent = always. */
  available?: () => Availability | Promise<Availability>;
  run: ( params: Record<string, unknown> ) => unknown;
}

/** A command as listed: no function, everything an agent needs to call it. */
export interface CommandInfo {
  id: string;
  title: string;
  description: string;
  params: ParamSpecs;
  available: boolean;
  /** Why not, when not. */
  reason?: string;
}

export type CommandErrorCode = "unknown" | "unavailable" | "invalid" | "failed";

export class CommandError extends Error {
  readonly code: CommandErrorCode;

  constructor(
    code: CommandErrorCode, message: string
  ) {
    super( message );
    this.name = "CommandError";
    this.code = code;
  }
}

export interface CommandRegistry {
  /** Register `specs` and answer the function that takes them back. A later id replaces an earlier one. */
  register: ( specs: readonly CommandSpec[] ) => () => void;
  list: () => Promise<CommandInfo[]>;
  /** Check availability and parameters, then run. Rejects with a `CommandError`. */
  execute: ( id: string, params?: unknown ) => Promise<unknown>;
}

export function isRecord( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

export function isImageResult( value: unknown ): value is ImageResult {
  return isRecord( value ) && value.kind === "image" && typeof value.data === "string";
}

/**
 * The parameters as `run` receives them: every declared field checked, a
 * number out of its bounds refused rather than clamped, unknown fields
 * refused. Throws `CommandError( "invalid" )` naming the field.
 */
export function checkParams(
  specs: ParamSpecs | undefined, raw: unknown
): Record<string, unknown> {
  const given = raw === undefined || raw === null ? {} : raw;

  if ( !isRecord( given ) ) {
    throw new CommandError(
      "invalid",
      "params must be an object"
    );
  }

  const declared = specs ?? {};

  for ( const key of Object.keys( given ) ) {
    if ( !( key in declared ) ) {
      const known = Object.keys( declared );

      throw new CommandError(
        "invalid",
        `unknown parameter "${ key }"${ known.length ? ` — this command takes ${ known.join( ", " ) }` : " — this command takes none" }`
      );
    }
  }

  const out: Record<string, unknown> = {};

  for ( const [
    key,
    spec
  ] of Object.entries( declared ) ) {
    const value = given[ key ];

    if ( value === undefined || value === null ) {
      if ( !spec.optional ) {
        throw new CommandError(
          "invalid",
          `missing parameter "${ key }"`
        );
      }
      continue;
    }

    switch ( spec.type ) {
      case "number":
        if ( typeof value !== "number" || !Number.isFinite( value ) ) {
          throw new CommandError(
            "invalid",
            `"${ key }" must be a finite number`
          );
        }
        if ( spec.integer && !Number.isInteger( value ) ) {
          throw new CommandError(
            "invalid",
            `"${ key }" must be a whole number`
          );
        }
        if ( spec.min !== undefined && value < spec.min ) {
          throw new CommandError(
            "invalid",
            `"${ key }" is ${ value }, below its minimum ${ spec.min }`
          );
        }
        if ( spec.max !== undefined && value > spec.max ) {
          throw new CommandError(
            "invalid",
            `"${ key }" is ${ value }, above its maximum ${ spec.max }`
          );
        }
        break;
      case "string":
        if ( typeof value !== "string" ) {
          throw new CommandError(
            "invalid",
            `"${ key }" must be a string`
          );
        }
        if ( spec.enum && !spec.enum.includes( value ) ) {
          throw new CommandError(
            "invalid",
            `"${ key }" is "${ value }" — one of ${ spec.enum.map( ( e ) => `"${ e }"` ).join( ", " ) }`
          );
        }
        break;
      case "boolean":
        if ( typeof value !== "boolean" ) {
          throw new CommandError(
            "invalid",
            `"${ key }" must be true or false`
          );
        }
        break;
      case "strings":
        if ( !Array.isArray( value ) || value.some( ( s ) => typeof s !== "string" ) ) {
          throw new CommandError(
            "invalid",
            `"${ key }" must be a list of strings`
          );
        }
        break;
      case "object":
        if ( !isRecord( value ) ) {
          throw new CommandError(
            "invalid",
            `"${ key }" must be an object`
          );
        }
        break;
    }

    out[ key ] = value;
  }

  return out;
}

/** The parameters as a JSON Schema object — what an MCP client is handed as a tool's input schema. */
export function paramsJsonSchema( specs: ParamSpecs | undefined ): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for ( const [
    key,
    spec
  ] of Object.entries( specs ?? {} ) ) {
    let prop: Record<string, unknown>;

    switch ( spec.type ) {
      case "number":
        prop = {
          type: spec.integer ? "integer" : "number",
          ...( spec.min !== undefined ? {
            minimum: spec.min
          } : {} ),
          ...( spec.max !== undefined ? {
            maximum: spec.max
          } : {} )
        };
        break;
      case "string":
        prop = {
          type: "string",
          ...( spec.enum ? {
            enum: [
              ...spec.enum
            ]
          } : {} )
        };
        break;
      case "boolean":
        prop = {
          type: "boolean"
        };
        break;
      case "strings":
        prop = {
          type: "array",
          items: {
            type: "string"
          }
        };
        break;
      case "object":
        prop = {
          type: "object"
        };
        break;
    }

    properties[ key ] = {
      ...prop,
      description: spec.description
    };
    if ( !spec.optional ) {
      required.push( key );
    }
  }

  return {
    type: "object",
    properties,
    ...( required.length ? {
      required
    } : {} ),
    additionalProperties: false
  };
}

function messageOf( error: unknown ): string {
  return error instanceof Error ? error.message : String( error );
}

async function availability( spec: CommandSpec ): Promise<Availability> {
  try {
    return spec.available ? await spec.available() : true;
  } catch( error ) {
    return messageOf( error );
  }
}

export function createCommandRegistry(): CommandRegistry {
  const byId = new Map<string, CommandSpec>();

  return {
    register( specs ) {
      for ( const spec of specs ) {
        byId.set(
          spec.id,
          spec
        );
      }

      return () => {
        for ( const spec of specs ) {
          if ( byId.get( spec.id ) === spec ) {
            byId.delete( spec.id );
          }
        }
      };
    },

    async list() {
      const ids = [
        ...byId.keys()
      ].sort();

      return Promise.all( ids.map( async( id ) => {
        const spec = byId.get( id ) as CommandSpec;
        const a = await availability( spec );
        const info: CommandInfo = {
          id,
          title: spec.title,
          description: spec.description,
          params: spec.params ?? {},
          available: a === true
        };

        if ( a !== true ) {
          info.reason = a;
        }

        return info;
      } ) );
    },

    async execute(
      id, raw
    ) {
      const spec = byId.get( id );

      if ( !spec ) {
        const group = id.split( "." )[ 0 ];
        const near = [
          ...byId.keys()
        ].filter( ( k ) => k.split( "." )[ 0 ] === group ).sort();

        throw new CommandError(
          "unknown",
          `no command "${ id }"${ near.length ? ` — in that group: ${ near.join( ", " ) }` : ` — commands: ${ [
            ...byId.keys()
          ].sort().join( ", " ) }` }`
        );
      }

      const a = await availability( spec );

      if ( a !== true ) {
        throw new CommandError(
          "unavailable",
          a
        );
      }

      const params = checkParams(
        spec.params,
        raw
      );

      try {
        return await spec.run( params );
      } catch( error ) {
        if ( error instanceof CommandError ) {
          throw error;
        }
        throw new CommandError(
          "failed",
          messageOf( error )
        );
      }
    }
  };
}
