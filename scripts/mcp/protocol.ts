/**
 * The MCP side: JSON-RPC 2.0 messages in, answers out, over the command
 * registry. Three generic tools, named as Atelier names its own
 * (`atelier_status` / `atelier_commands` / `atelier_run`) so an agent meets the
 * same three doors in every project:
 *
 * - `sketchbook_status`   — `app.status`: where the server points and what is up;
 * - `sketchbook_commands` — every command with its JSON Schema and availability;
 * - `sketchbook_run`      — `{ command, params }` through `registry.execute`.
 *
 * Generic rather than one tool per command: the list is the registry's, so a
 * command added there is callable at once, and a command's availability (the
 * server is down, the queue is off) is read at the moment it is asked for.
 *
 * Pure: `handleMessage` takes a parsed message and answers one (or null for a
 * notification). The stdio loop is `sketchbook-mcp.ts`.
 */
import {
  CommandError, isImageResult, isRecord, paramsJsonSchema, type CommandRegistry
} from "./registry.ts";

/** Newest first; the client's own is echoed when it is one of these. */
export const PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05"
];

export const SERVER_INFO = {
  name: "sketchbook",
  version: "0.1.0"
};

const INSTRUCTIONS = [
  "Sketchbook renders creative-coding sketches (p5.js, GSAP, Three.js) and exports them as images and MP4s.",
  "Start with sketchbook_status, then sketchbook_commands for what you can do.",
  "Typical path: sketches.list → sketches.describe (parameters as JSON Schema) → render.frame to LOOK at a variation (it answers an image) → render.video → jobs.wait → jobs.result.",
  "Parameters outside a control's range are refused, never clamped: the error names the field and its bounds."
].join( " " );

const TOOLS = [
  {
    name: "sketchbook_status",
    description: "Where this MCP server points, whether Sketchbook answers there, the recording queue's health, the catalogue size and where files are written.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "sketchbook_commands",
    description: "Every Sketchbook command: dotted id, what it does, its parameters as JSON Schema, and whether it can run now (with the reason when not).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "sketchbook_run",
    description: "Run one Sketchbook command by id with its parameters (see sketchbook_commands). An image answer (render.frame) comes back as a picture you can look at.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Dotted command id, e.g. render.frame"
        },
        params: {
          type: "object",
          description: "The command's parameters"
        }
      },
      required: [
        "command"
      ],
      additionalProperties: false
    }
  }
];

type Content = { type: "text";
  text: string } | { type: "image";
    data: string;
    mimeType: string };

export interface ToolResult {
  content: Content[];
  isError?: boolean;
  [ key: string ]: unknown;
}

function text( value: unknown ): Content {
  return {
    type: "text",
    text: typeof value === "string" ? value : JSON.stringify(
      value,
      null,
      2
    )
  };
}

/** A command's answer as MCP content: a picture becomes an image block beside its note. */
export function toToolResult( value: unknown ): ToolResult {
  if ( isImageResult( value ) ) {
    return {
      content: [
        {
          type: "image",
          data: value.data,
          mimeType: value.mimeType
        },
        text( value.note ?? `${ value.width }×${ value.height } ${ value.mimeType }` )
      ]
    };
  }

  return {
    content: [
      text( value ?? null )
    ]
  };
}

function errorResult( error: unknown ): ToolResult {
  const message = error instanceof CommandError
    ? `${ error.code }: ${ error.message }`
    : `failed: ${ error instanceof Error ? error.message : String( error ) }`;

  return {
    content: [
      text( message )
    ],
    isError: true
  };
}

async function callTool(
  registry: CommandRegistry, name: unknown, args: unknown
): Promise<ToolResult> {
  const given = isRecord( args ) ? args : {};

  try {
    switch ( name ) {
      case "sketchbook_status":
        return toToolResult( await registry.execute( "app.status" ) );
      case "sketchbook_commands":
        return toToolResult( ( await registry.list() ).map( ( command ) => ( {
          id: command.id,
          title: command.title,
          description: command.description,
          params: paramsJsonSchema( command.params ),
          available: command.available,
          ...( command.reason ? {
            reason: command.reason
          } : {} )
        } ) ) );
      case "sketchbook_run":
        if ( typeof given.command !== "string" ) {
          throw new CommandError(
            "invalid",
            "\"command\" must be a command id — sketchbook_commands lists them"
          );
        }

        return toToolResult( await registry.execute(
          given.command,
          given.params
        ) );
      default:
        throw new CommandError(
          "unknown",
          `no tool "${ String( name ) }" — sketchbook_status, sketchbook_commands, sketchbook_run`
        );
    }
  } catch( error ) {
    return errorResult( error );
  }
}

export type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

/** One answer, or null when the message is a notification (no id). */
export async function handleMessage(
  registry: CommandRegistry, message: JsonRpcMessage
): Promise<Record<string, unknown> | null> {
  const isRequest = message.id !== undefined && message.id !== null;
  const reply = ( result: unknown ) => ( {
    jsonrpc: "2.0",
    id: message.id,
    result
  } );
  const fail = (
    code: number, text: string
  ) => ( {
    jsonrpc: "2.0",
    id: message.id ?? null,
    error: {
      code,
      message: text
    }
  } );

  if ( typeof message.method !== "string" ) {
    return isRequest ? fail(
      -32600,
      "invalid request"
    ) : null;
  }

  const params = isRecord( message.params ) ? message.params : {};

  switch ( message.method ) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";

      return reply( {
        protocolVersion: PROTOCOL_VERSIONS.includes( asked ) ? asked : PROTOCOL_VERSIONS[ 0 ],
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS
      } );
    }
    case "ping":
      return reply( {} );
    case "tools/list":
      return reply( {
        tools: TOOLS
      } );
    case "tools/call":
      return reply( await callTool(
        registry,
        params.name,
        params.arguments
      ) );
    default:
      // Notifications (initialized, cancelled…) need no answer.
      return isRequest ? fail(
        -32601,
        `method not found: ${ message.method }`
      ) : null;
  }
}
