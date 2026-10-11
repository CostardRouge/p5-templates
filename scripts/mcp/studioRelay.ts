/**
 * The STUDIO relay — level 1 of Sketchbook's MCP: an MCP server on stdio for
 * Claude Code (or any MCP client) that relays to the Sketchbook TAB the person
 * connected, over 127.0.0.1 only: Server-Sent Events down to the tab, POSTs
 * back. The commands live in the tab (`src/lib/agent/`), registered by the
 * sketch page and run through the very funnels its controls use; this process
 * only moves messages and writes the files an export hands it.
 *
 * Same shape as Atelier's bridge (`CostardRouge/atelier`,
 * `scripts/atelier-mcp.mjs`) on purpose — one relay idiom across the
 * portfolio. Port 7982 by default, so both can run at once.
 *
 * It is ONE file with no import but Node's own modules, because it is also
 * served by every deployment as `/mcp/sketchbook-studio-mcp.mjs` (generated
 * from this file by `npm run mcp:relay:write`, drift-tested): someone without
 * the repository downloads it and runs it.
 *
 *   curl -fsSLo ~/.sketchbook-studio-mcp.mjs https://<site>/mcp/sketchbook-studio-mcp.mjs
 *   claude mcp add sketchbook-studio -- node ~/.sketchbook-studio-mcp.mjs
 *
 * Options: --port N (SKETCHBOOK_RELAY_PORT), --out DIR (SKETCHBOOK_OUT; default
 * ~/Movies/Sketchbook) for exported files, SKETCHBOOK_ORIGINS=https://a,https://b
 * for pages other than loopback and the official site. Node >= 18.
 * stdout carries the protocol and nothing else — every log goes to stderr.
 */
import {
  randomBytes
} from "node:crypto";
import {
  createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync
} from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

export const RELAY_VERSION = "1.1.0";
export const DEFAULT_PORT = 7982;
/** An exported video can be long; a runaway stream cannot fill the disk. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
/** A snapshot is a few MB of base64; far above it. */
export const MAX_BODY_BYTES = 64 * 1024 * 1024;
/** The official deployment; any other site is added with SKETCHBOOK_ORIGINS. */
export const DEFAULT_ORIGINS = [
  "https://p5.steeve.website"
];

const PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05"
];

/* ---- pure decisions (tested in scripts/mcp/__tests__/studioRelay.test.ts) ---- */

/**
 * Who may connect as the tab: a page on loopback (any port — `npm run dev`),
 * the official site, or one the person listed. A browser cannot forge Origin,
 * so no other site open in it can receive the agent's commands; a request with
 * none (curl) is refused too.
 */
export function originAllowed(
  origin: string | undefined, extra: readonly string[]
): boolean {
  if ( !origin ) {
    return false;
  }
  if ( /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test( origin ) ) {
    return true;
  }

  return [
    ...DEFAULT_ORIGINS,
    ...extra
  ].includes( origin.replace(
    /\/+$/,
    ""
  ) );
}

export type TabMessage =
  | { hello: { title: string;
    route: string;
    sketch: string } }
  | { id: string;
    ok: true;
    result: unknown }
  | { id: string;
    ok: false;
    error: { code: string;
      message: string } };

function isRecord( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

/** What the tab POSTs, or null when it is not one of the three shapes. */
export function parseTabMessage( text: string ): TabMessage | null {
  let value: unknown;

  try {
    value = JSON.parse( text );
  } catch {
    return null;
  }
  if ( !isRecord( value ) ) {
    return null;
  }
  if ( isRecord( value.hello ) ) {
    const hello = value.hello;

    return {
      hello: {
        title: String( hello.title ?? "" ),
        route: String( hello.route ?? "" ),
        sketch: String( hello.sketch ?? "" )
      }
    };
  }
  if ( typeof value.id !== "string" ) {
    return null;
  }
  if ( value.ok === true ) {
    return {
      id: value.id,
      ok: true,
      result: value.result
    };
  }
  if ( value.ok === false && isRecord( value.error ) ) {
    return {
      id: value.id,
      ok: false,
      error: {
        code: String( value.error.code ?? "failed" ),
        message: String( value.error.message ?? "" )
      }
    };
  }

  return null;
}

/**
 * Where a file from the tab may land under the output folder, as path
 * segments, or null: plain names only — no `.`/`..` or empty segment, no
 * separator inside a name, no control character.
 */
export function safeOutputPath(
  folder: string, name: string
): string[] | null {
  const segments = [
    ...( folder ? folder.split( "/" ) : [] ),
    name
  ];

  for ( const segment of segments ) {
    if ( !segment || segment === "." || segment === ".." || /[\\/\u0000-\u001f]/.test( segment ) || segment.length > 200 ) {
      return null;
    }
  }

  return segments;
}

/** `clip.mp4` → `clip-1.mp4`: the next name when one is taken. */
export function numberedName(
  name: string, n: number
): string {
  const dot = name.lastIndexOf( "." );

  return dot > 0 ? `${ name.slice(
    0,
    dot
  ) }-${ n }${ name.slice( dot ) }` : `${ name }-${ n }`;
}

type Content = { type: "text";
  text: string } | { type: "image";
    data: string;
    mimeType: string };

/** A command's answer as MCP content: an image result becomes an image block beside its note. */
export function toolContent( value: unknown ): Content[] {
  if ( isRecord( value ) && value.kind === "image" && typeof value.data === "string" ) {
    return [
      {
        type: "image",
        data: value.data,
        mimeType: String( value.mimeType ?? "image/png" )
      },
      {
        type: "text",
        text: String( value.note ?? `${ value.width }×${ value.height }` )
      }
    ];
  }

  return [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(
        value ?? null,
        null,
        2
      )
    }
  ];
}

/* ---- two MCP apps, one tab: the second relay FOLLOWS the first ---- */

/**
 * Claude Desktop and Claude Code each start their own relay, and only one can
 * hold the port. The one that does is the HUB (the tab connects to it); a relay
 * that finds the port taken by another Sketchbook relay FOLLOWS it, passing its
 * tool calls through the hub's `/peer/*` routes — the hub's tab, the hub's
 * output folder. Those routes are for programs on this computer only: they
 * refuse any request carrying an `Origin` (every browser request does) and ask
 * for the hub's TOKEN, written to a file only this user can read. A follower
 * whose hub goes away takes the port itself, and the tab reconnects to it.
 * Same scheme as Atelier's bridge (`scripts/atelier-mcp.mjs`).
 */
export const PEER_STATUS_PATH = "/peer/status";
export const PEER_RELAY_PATH = "/peer/relay";

/** The token file's name for a port, inside `~/.sketchbook/`. */
export function peerTokenFile( port: number ): string {
  return `relay-${ port }.token`;
}

/**
 * Whether a request to a `/peer/*` route may pass: no `Origin` (so not a web
 * page) and the hub's token as a bearer, compared in constant time.
 */
export function peerAuthorized(
  headers: { origin?: string;
    authorization?: string }, token: string
): boolean {
  if ( headers.origin !== undefined || !token || token.length < 32 ) {
    return false;
  }

  const given = /^Bearer (.+)$/.exec( headers.authorization ?? "" )?.[ 1 ] ?? "";

  if ( given.length !== token.length ) {
    return false;
  }

  let diff = 0;

  for ( let i = 0; i < token.length; i++ ) {
    diff |= given.charCodeAt( i ) ^ token.charCodeAt( i );
  }

  return diff === 0;
}

export type RelayRequest = { kind: "list" } | { kind: "run";
  command: string;
  params: unknown };

/** A follower's relay request, or null when the body is not one. */
export function parsePeerRequest( text: string ): RelayRequest | null {
  let value: unknown;

  try {
    value = JSON.parse( text );
  } catch {
    return null;
  }
  if ( !isRecord( value ) ) {
    return null;
  }
  if ( value.kind === "list" ) {
    return {
      kind: "list"
    };
  }
  if ( value.kind === "run" && typeof value.command === "string" && value.command ) {
    const params = value.params === undefined ? {} : value.params;

    return isRecord( params ) ? {
      kind: "run",
      command: value.command,
      params
    } : null;
  }

  return null;
}

export type TabInfo = { title: string;
  route: string;
  sketch: string;
  origin: string;
  since: number };

export interface RelayDeps {
  port: number;
  outDir: string;
  /** Why the relay cannot listen, if it cannot. */
  problem: () => string | null;
  /** The connected tab — asked of the HUB when this relay only follows it, hence the promise. */
  tab: () => TabInfo | null | Promise<TabInfo | null>;
  relay: ( request: RelayRequest ) => Promise<unknown>;
}

export const RELAY_TOOLS = [
  {
    name: "sketchbook_studio_status",
    description: "Whether a Sketchbook tab is connected to this relay (and which sketch it shows), the port, and where exported files are written. Call first.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "sketchbook_studio_commands",
    description: "Every command the connected Sketchbook tab offers right now: dotted id, what it does, its parameters as JSON Schema, and whether it can run (with the reason when not).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "sketchbook_studio_run",
    description: "Run one command in the connected Sketchbook tab (see sketchbook_studio_commands). Changes land in the open studio exactly as a click would; a snapshot comes back as a picture you can look at.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Dotted command id, e.g. sketch.set"
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

const INSTRUCTIONS = [
  "This relays to a Sketchbook studio tab the person opened and connected (studio menu → Connect an agent).",
  "Call sketchbook_studio_status first; if no tab is connected, ask the person to connect one.",
  "Then sketchbook_studio_commands lists what the tab can do now — the sketch's parameters, canvas size and clock, content items (text, images, HUD), slides, moving items, playback, snapshots, exports.",
  "Look at your work with the snapshot command (it answers an image). Parameters out of range are refused, never clamped."
].join( " " );

function errorContent( error: unknown ) {
  return {
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : String( error )
      }
    ],
    isError: true
  };
}

async function callTool(
  deps: RelayDeps, name: unknown, args: unknown
) {
  const given = isRecord( args ) ? args : {};

  try {
    if ( name === "sketchbook_studio_status" ) {
      const tab = deps.problem() ? null : await deps.tab();

      return {
        content: toolContent( {
          connected: Boolean( tab ),
          ...( tab ? {
            tab
          } : {
            how: "Open a sketch on the Sketchbook site, then in the studio menu choose Connect an agent (the relay must be running — it is: this answer comes from it)."
          } ),
          port: deps.port,
          exportsGoTo: deps.outDir,
          relay: RELAY_VERSION,
          ...( deps.problem() ? {
            problem: deps.problem()
          } : {} )
        } )
      };
    }
    if ( deps.problem() ) {
      throw new Error( deps.problem() as string );
    }
    if ( name === "sketchbook_studio_commands" ) {
      return {
        content: toolContent( await deps.relay( {
          kind: "list"
        } ) )
      };
    }
    if ( name === "sketchbook_studio_run" ) {
      if ( typeof given.command !== "string" ) {
        throw new Error( "invalid: \"command\" must be a command id — sketchbook_studio_commands lists them" );
      }

      return {
        content: toolContent( await deps.relay( {
          kind: "run",
          command: given.command,
          params: given.params ?? {}
        } ) )
      };
    }
    throw new Error( `unknown: no tool "${ String( name ) }"` );
  } catch( error ) {
    return errorContent( error );
  }
}

/** One MCP message in, one answer out (null for a notification). */
export async function handleMcpMessage(
  message: Record<string, unknown>, deps: RelayDeps
): Promise<Record<string, unknown> | null> {
  const isRequest = message.id !== undefined && message.id !== null;
  const params = isRecord( message.params ) ? message.params : {};
  const reply = ( result: unknown ) => ( {
    jsonrpc: "2.0",
    id: message.id,
    result
  } );

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
        serverInfo: {
          name: "sketchbook-studio",
          version: RELAY_VERSION
        },
        instructions: INSTRUCTIONS
      } );
    }
    case "ping":
      return reply( {} );
    case "tools/list":
      return reply( {
        tools: RELAY_TOOLS
      } );
    case "tools/call":
      return reply( await callTool(
        deps,
        params.name,
        params.arguments
      ) );
    default:
      return isRequest
        ? {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32601,
            message: `method not found: ${ String( message.method ) }`
          }
        }
        : null;
  }
}

/* ---- the process: HTTP for the tab, stdio for the MCP client ---- */

/** Long enough for an export of a few minutes behind a slow GPU. */
const RUN_TIMEOUT_MS = 30 * 60 * 1000;
const LIST_TIMEOUT_MS = 15_000;

function argument( flag: string ): string | undefined {
  const i = process.argv.indexOf( flag );

  return i >= 0 ? process.argv[ i + 1 ] : undefined;
}

export function startRelay(): void {
  const log = ( ...parts: unknown[] ) => process.stderr.write( `[sketchbook-studio-mcp] ${ parts.join( " " ) }\n` );
  const portArgument = Number( argument( "--port" ) ?? process.env.SKETCHBOOK_RELAY_PORT );
  const port = Number.isInteger( portArgument ) && portArgument > 0 ? portArgument : DEFAULT_PORT;
  const outDir = path.resolve( argument( "--out" ) ?? process.env.SKETCHBOOK_OUT ?? path.join(
    os.homedir(),
    "Movies",
    "Sketchbook"
  ) );
  const extraOrigins = ( process.env.SKETCHBOOK_ORIGINS ?? "" ).split( "," ).map( ( s ) => s.trim().replace(
    /\/+$/,
    ""
  ) )
    .filter( Boolean );
  let tab: { res: http.ServerResponse;
    title: string;
    route: string;
    sketch: string;
    origin: string;
    since: number } | null = null;
  let problem: string | null = null;
  let nextId = 1;
  const pending = new Map<string, { resolve: ( value: unknown ) => void;
    reject: ( error: Error ) => void;
    timer: NodeJS.Timeout }>();

  function dropPending( reason: string ) {
    for ( const [
      id,
      entry
    ] of pending ) {
      clearTimeout( entry.timer );
      entry.reject( new Error( reason ) );
      pending.delete( id );
    }
  }

  function relay( request: RelayRequest ): Promise<unknown> {
    if ( !tab ) {
      return Promise.reject( new Error( "unavailable: no Sketchbook tab is connected — open a sketch and choose Connect an agent in the studio menu" ) );
    }

    const id = String( nextId++ );
    const limit = request.kind === "list" ? LIST_TIMEOUT_MS : RUN_TIMEOUT_MS;
    const open = tab;

    return new Promise( (
      resolve, reject
    ) => {
      const timer = setTimeout(
        () => {
          pending.delete( id );
          reject( new Error( `failed: the tab did not answer within ${ limit / 1000 } s — is it still open?` ) );
        },
        limit
      );

      pending.set(
        id,
        {
          resolve,
          reject,
          timer
        }
      );
      open.res.write( `data: ${ JSON.stringify( {
        id,
        ...request
      } ) }\n\n` );
    } );
  }

  /* -- hub or follower (see PEER_STATUS_PATH) -- */

  /** `hub` holds the port and the tab; `follower` relays through the hub. */
  let mode: "starting" | "hub" | "follower" = "starting";
  const currentMode = () => mode;
  /** The hub's secret, written where only this user can read it. */
  let hubToken: string | null = null;
  /** What the hub last said, while following it. */
  let followed: { outDir?: string;
    tab?: TabInfo | null } | null = null;
  const tokenDir = path.join(
    os.homedir(),
    ".sketchbook"
  );
  const tokenPath = path.join(
    tokenDir,
    peerTokenFile( port )
  );
  const hub = `http://127.0.0.1:${ port }`;
  const tabInfo = (): TabInfo | null => tab ? {
    title: tab.title,
    route: tab.route,
    sketch: tab.sketch,
    origin: tab.origin,
    since: tab.since
  } : null;

  function writeToken() {
    hubToken = randomBytes( 32 ).toString( "hex" );
    try {
      mkdirSync(
        tokenDir,
        {
          recursive: true,
          mode: 0o700
        }
      );
      writeFileSync(
        tokenPath,
        hubToken,
        {
          mode: 0o600
        }
      );
    } catch( error ) {
      log( `could not write ${ tokenPath } (${ ( error as Error ).message }) — a second MCP app will not be able to share this relay` );
    }
  }

  function dropToken() {
    try {
      if ( hubToken && readFileSync(
        tokenPath,
        "utf8"
      ) === hubToken ) {
        rmSync(
          tokenPath,
          {
            force: true
          }
        );
      }
    } catch {
      // Already gone, or another hub's by now.
    }
  }

  async function askHub(
    pathname: string, body?: RelayRequest
  ): Promise<Record<string, unknown>> {
    let token: string;

    try {
      token = readFileSync(
        tokenPath,
        "utf8"
      ).trim();
    } catch {
      throw new Error( "no hub token" );
    }

    const answer = await fetch(
      `${ hub }${ pathname }`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${ token }`,
          ...( body === undefined ? {} : {
            "content-type": "application/json"
          } )
        },
        body: body === undefined ? undefined : JSON.stringify( body )
      }
    );

    if ( !answer.ok ) {
      throw new Error( `the relay on port ${ port } answered ${ answer.status }` );
    }

    return await answer.json() as Record<string, unknown>;
  }

  /** The port is taken: follow it if a Sketchbook relay holds it, else say so. */
  async function follow() {
    try {
      followed = await askHub( PEER_STATUS_PATH );
      if ( mode !== "follower" ) {
        log( `port ${ port } is held by another Sketchbook relay — following it (its tab, its output folder)` );
      }
      mode = "follower";
      problem = null;
    } catch {
      mode = "starting";
      followed = null;
      problem = `unavailable: the relay could not listen on 127.0.0.1:${ port }, and what holds that port is not a Sketchbook relay it can share — stop that program, or start this one with --port N and connect the tab on that port`;
      log( problem );
    }
  }

  /** The last follow attempt, so whoever waits on the port can wait on it too. */
  let following: Promise<void> | null = null;
  /** Settled once this relay knows whether it is the hub or a follower. */
  let settle: () => void = () => undefined;
  const settled = new Promise<void>( ( resolve ) => {
    settle = resolve;
  } );

  /** The hub went away: take the port (the tab reconnects by itself), else follow whoever did. */
  let takingOver: Promise<void> | null = null;

  function takeOver(): Promise<void> {
    takingOver ??= new Promise<void>( ( resolve ) => {
      mode = "starting";
      followed = null;

      const onListening = () => {
        server.off(
          "error",
          onError
        );
        resolve();
      };
      // The standing error handler starts `following`; wait for it to land.
      const onError = () => {
        server.off(
          "listening",
          onListening
        );
        setImmediate( () => void ( following ?? Promise.resolve() ).then( resolve ) );
      };

      server.once(
        "listening",
        onListening
      );
      server.once(
        "error",
        onError
      );
      server.listen(
        port,
        "127.0.0.1"
      );
    } ).finally( () => {
      takingOver = null;
    } );

    return takingOver;
  }

  async function currentTab(): Promise<TabInfo | null> {
    await settled;
    if ( takingOver ) {
      await takingOver;
    }
    if ( mode === "hub" ) {
      return tabInfo();
    }
    if ( mode !== "follower" ) {
      return null;
    }
    try {
      followed = await askHub( PEER_STATUS_PATH );

      return followed.tab ?? null;
    } catch {
      await takeOver();

      // `takeOver` changed the mode behind the await.
      return currentMode() === "hub" ? null : followed?.tab ?? null;
    }
  }

  async function relayAny( request: RelayRequest ): Promise<unknown> {
    await settled;
    if ( takingOver ) {
      await takingOver;
    }
    if ( mode === "hub" ) {
      return relay( request );
    }
    if ( mode !== "follower" ) {
      throw new Error( problem ?? "unavailable: the relay is not ready" );
    }

    let answer: Record<string, unknown>;

    try {
      answer = await askHub(
        PEER_RELAY_PATH,
        request
      );
    } catch {
      await takeOver();
      throw new Error( "unavailable: the relay holding the tab went away and this one took its place — the tab reconnects by itself (or choose Connect an agent again); retry" );
    }
    if ( answer.ok ) {
      return answer.result;
    }
    throw new Error( String( ( answer.error as { message?: string } | undefined )?.message ?? "failed: the hub relay refused the call" ) );
  }

  function peerRoute(
    req: http.IncomingMessage, res: http.ServerResponse, route: string
  ) {
    const json = (
      code: number, body: unknown
    ) => {
      res.writeHead(
        code,
        {
          "content-type": "application/json"
        }
      );
      res.end( JSON.stringify( body ) );
    };

    if ( !peerAuthorized(
      {
        origin: req.headers.origin,
        authorization: req.headers.authorization
      },
      hubToken ?? ""
    ) ) {
      json(
        403,
        {
          error: "not a relay on this computer"
        }
      );

      return;
    }
    if ( req.method === "GET" && route === PEER_STATUS_PATH ) {
      json(
        200,
        {
          relay: RELAY_VERSION,
          outDir,
          tab: tabInfo()
        }
      );

      return;
    }
    if ( req.method === "POST" && route === PEER_RELAY_PATH ) {
      const chunks: Buffer[] = [];
      let size = 0;

      req.on(
        "data",
        ( chunk: Buffer ) => {
          size += chunk.length;
          if ( size > MAX_BODY_BYTES ) {
            req.destroy();
          } else {
            chunks.push( chunk );
          }
        }
      );
      req.on(
        "end",
        () => {
          const request = parsePeerRequest( Buffer.concat( chunks ).toString( "utf8" ) );

          if ( !request ) {
            json(
              400,
              {
                error: "not a relay request"
              }
            );

            return;
          }
          relay( request ).then(
            ( result ) => json(
              200,
              {
                ok: true,
                result
              }
            ),
            ( error: Error ) => json(
              200,
              {
                ok: false,
                error: {
                  message: error.message
                }
              }
            )
          );
        }
      );

      return;
    }
    json(
      404,
      {
        error: "no such route"
      }
    );
  }

  const server = http.createServer( (
    req, res
  ) => {
    const origin = req.headers.origin;
    const peerPath = ( req.url ?? "/" ).split( "?" )[ 0 ];

    if ( peerPath.startsWith( "/peer/" ) ) {
      peerRoute(
        req,
        res,
        peerPath
      );

      return;
    }

    if ( !originAllowed(
      origin,
      extraOrigins
    ) ) {
      res.writeHead(
        403,
        {
          "content-type": "text/plain"
        }
      );
      res.end( "origin not allowed\n" );
      if ( origin ) {
        log( `refused ${ origin } — add it with SKETCHBOOK_ORIGINS` );
      }

      return;
    }

    const cors = {
      "Access-Control-Allow-Origin": origin as string,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-sketchbook-name, x-sketchbook-folder",
      // Chrome's Private / Local Network Access: a public page reaching loopback asks this.
      "Access-Control-Allow-Private-Network": "true",
      Vary: "Origin"
    };
    const route = ( req.url ?? "/" ).split( "?" )[ 0 ];

    if ( req.method === "OPTIONS" ) {
      res.writeHead(
        204,
        cors
      );
      res.end();

      return;
    }

    if ( req.method === "GET" && route === "/events" ) {
      // A newer tab REPLACES the older one: the person connected it last.
      if ( tab ) {
        tab.res.write( "event: replaced\ndata: {}\n\n" );
        tab.res.end();
        dropPending( "failed: the tab was replaced by another one" );
      }
      res.writeHead(
        200,
        {
          ...cors,
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive"
        }
      );
      res.write( `event: welcome\ndata: ${ JSON.stringify( {
        relay: RELAY_VERSION,
        exportsGoTo: outDir
      } ) }\n\n` );

      const me = {
        res,
        title: "",
        route: "",
        sketch: "",
        origin: origin as string,
        since: Date.now()
      };
      const keepAlive = setInterval(
        () => res.write( ": keep-alive\n\n" ),
        15_000
      );

      tab = me;
      log( `tab connected from ${ origin }` );
      req.on(
        "close",
        () => {
          clearInterval( keepAlive );
          if ( tab === me ) {
            tab = null;
            dropPending( "failed: the tab disconnected" );
            log( "tab disconnected" );
          }
        }
      );

      return;
    }

    if ( req.method === "POST" && route === "/message" ) {
      const chunks: Buffer[] = [];
      let size = 0;

      req.on(
        "data",
        ( chunk: Buffer ) => {
          size += chunk.length;
          if ( size > MAX_BODY_BYTES ) {
            res.writeHead(
              413,
              cors
            );
            res.end();
            req.destroy();

            return;
          }
          chunks.push( chunk );
        }
      );
      req.on(
        "end",
        () => {
          if ( res.writableEnded ) {
            return;
          }

          const message = parseTabMessage( Buffer.concat( chunks ).toString( "utf8" ) );

          if ( !message ) {
            res.writeHead(
              400,
              cors
            );
            res.end();

            return;
          }
          if ( "hello" in message ) {
            if ( tab ) {
              Object.assign(
                tab,
                message.hello
              );
            }
          } else {
            const entry = pending.get( message.id );

            if ( entry ) {
              pending.delete( message.id );
              clearTimeout( entry.timer );
              if ( message.ok ) {
                entry.resolve( message.result );
              } else {
                entry.reject( new Error( `${ message.error.code }: ${ message.error.message }` ) );
              }
            }
          }
          res.writeHead(
            204,
            cors
          );
          res.end();
        }
      );

      return;
    }

    if ( req.method === "POST" && route === "/file" ) {
      // A file the tab exported for the agent, streamed to disk under outDir —
      // never outside it, never over an existing file.
      const fail = (
        code: number, message: string
      ) => {
        if ( !res.headersSent ) {
          res.writeHead(
            code,
            {
              ...cors,
              "content-type": "application/json"
            }
          );
        }
        res.end( JSON.stringify( {
          error: message
        } ) );
      };
      let name = "";
      let folder = "";

      try {
        name = decodeURIComponent( String( req.headers[ "x-sketchbook-name" ] ?? "" ) );
        folder = decodeURIComponent( String( req.headers[ "x-sketchbook-folder" ] ?? "" ) );
      } catch {
        fail(
          400,
          "the file name is not readable"
        );

        return;
      }

      const segments = safeOutputPath(
        folder,
        name
      );

      if ( !segments ) {
        fail(
          400,
          `refused to write "${ folder ? `${ folder }/` : "" }${ name }" — not a plain name under the output folder`
        );

        return;
      }

      const directory = path.join(
        outDir,
        ...segments.slice(
          0,
          -1
        )
      );

      mkdirSync(
        directory,
        {
          recursive: true
        }
      );

      let n = 0;
      const last = segments[ segments.length - 1 ];
      let target = path.join(
        directory,
        last
      );

      while ( existsSync( target ) ) {
        target = path.join(
          directory,
          numberedName(
            last,
            ++n
          )
        );
      }

      const partial = `${ target }.part`;
      const out = createWriteStream( partial );
      let size = 0;

      req.on(
        "data",
        ( chunk: Buffer ) => {
          size += chunk.length;
          if ( size > MAX_FILE_BYTES ) {
            req.destroy();
            out.destroy();
            rmSync(
              partial,
              {
                force: true
              }
            );
            fail(
              413,
              "the file is larger than the relay writes"
            );
          }
        }
      );
      req.pipe( out );
      out.on(
        "finish",
        () => {
          if ( res.writableEnded ) {
            return;
          }
          renameSync(
            partial,
            target
          );
          log( `wrote ${ target } (${ ( size / 1048576 ).toFixed( 1 ) } MB)` );
          res.writeHead(
            200,
            {
              ...cors,
              "content-type": "application/json"
            }
          );
          res.end( JSON.stringify( {
            path: target,
            bytes: size,
            renamed: n > 0
          } ) );
        }
      );
      out.on(
        "error",
        ( error ) => {
          rmSync(
            partial,
            {
              force: true
            }
          );
          fail(
            500,
            error.message
          );
        }
      );

      return;
    }

    res.writeHead(
      404,
      cors
    );
    res.end();
  } );

  server.on(
    "listening",
    () => {
      mode = "hub";
      problem = null;
      writeToken();
      settle();
      log( `listening on http://127.0.0.1:${ port } — in the studio menu, choose Connect an agent` );
    }
  );
  server.on(
    "error",
    ( error: NodeJS.ErrnoException ) => {
      if ( error.code === "EADDRINUSE" ) {
        following = follow().finally( settle );

        return;
      }
      problem = `unavailable: the relay could not listen: ${ error.message }`;
      log( problem );
      settle();
    }
  );
  server.listen(
    port,
    "127.0.0.1"
  );

  // A follower takes the port as soon as its hub quits, not at its next tool
  // call: the tab is retrying meanwhile and should find a relay quickly.
  setInterval(
    () => {
      if ( mode === "follower" && !takingOver ) {
        askHub( PEER_STATUS_PATH ).then(
          ( answer ) => {
            followed = answer;
          },
          () => void takeOver()
        );
      }
    },
    5_000
  ).unref();

  const deps: RelayDeps = {
    port,
    get outDir() {
      return mode === "follower" ? String( followed?.outDir ?? outDir ) : outDir;
    },
    problem: () => problem,
    tab: currentTab,
    relay: relayAny
  };
  const send = ( message: unknown ) => process.stdout.write( `${ JSON.stringify( message ) }\n` );
  const lines = readline.createInterface( {
    input: process.stdin
  } );

  lines.on(
    "line",
    ( line ) => {
      if ( !line.trim() ) {
        return;
      }

      let message: Record<string, unknown>;

      try {
        message = JSON.parse( line );
      } catch {
        send( {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "parse error"
          }
        } );

        return;
      }
      handleMcpMessage(
        message,
        deps
      ).then(
        ( answer ) => {
          if ( answer ) {
            send( answer );
          }
        },
        ( error: unknown ) => send( {
          jsonrpc: "2.0",
          id: message.id ?? null,
          error: {
            code: -32603,
            message: String( error )
          }
        } )
      );
    }
  );
  // The client closing stdin is how an MCP session ends.
  lines.on(
    "close",
    () => {
      dropToken();
      server.close();
      process.exit( 0 );
    }
  );
  for ( const signal of [
    "SIGINT",
    "SIGTERM"
  ] ) {
    process.on(
      signal,
      () => {
        dropToken();
        process.exit( 0 );
      }
    );
  }
}

// Run when executed (from source or as the served .mjs), not when a test imports it.
if ( /sketchbook-studio-mcp\.mjs$|studioRelay\.ts$/.test( process.argv[ 1 ] ?? "" ) && process.env.SKETCHBOOK_RELAY_NO_START !== "1" ) {
  startRelay();
}
