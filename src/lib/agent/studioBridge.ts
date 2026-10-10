/**
 * The tab's end of the studio relay (MCP level 1; `scripts/mcp/studioRelay.ts`).
 *
 * The person starts the relay on their machine and connects THIS tab from the
 * menu (Connect an agent). The tab opens a Server-Sent Events stream to
 * `127.0.0.1:<port>/events`, answers each `{ id, kind }` it receives by POSTing
 * to `/message`, and hands exported files to `/file`. Nothing connects unless
 * the person asks; a tab that was connected reconnects after a reload of the
 * same browser tab (sessionStorage), never another one.
 *
 * The commands themselves live in `studioCommands`, registered by the sketch
 * page while it is mounted (`useStudioCommands`) — the same registry shapes as
 * the level-2 server (`scripts/mcp/registry.ts`), imported from there so the
 * two cannot drift. `window.sketchbook` is the console's door to the same
 * registry: `sketchbook.commands()`, `sketchbook.run( "sketch.set", {…} )`.
 */
import {
  CommandError, createCommandRegistry, paramsJsonSchema, type CommandRegistry
} from "../../../scripts/mcp/registry.ts";

export const RELAY_DEFAULT_PORT = 7982;
const SESSION_KEY = "sketchbook:agent-relay";

export const studioCommands: CommandRegistry = createCommandRegistry();

export type BridgeStatus =
  | { state: "off" }
  | { state: "connecting";
    port: number }
  | { state: "connected";
    port: number;
    exportsGoTo?: string }
  | { state: "error";
    port: number;
    message: string };

let status: BridgeStatus = {
  state: "off"
};
let source: EventSource | null = null;
const listeners = new Set<() => void>();

function setStatus( next: BridgeStatus ): void {
  status = next;
  for ( const listener of [
    ...listeners
  ] ) {
    listener();
  }
}

export function getBridgeStatus(): BridgeStatus {
  return status;
}

export function subscribeBridge( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

function base( port: number ): string {
  return `http://127.0.0.1:${ port }`;
}

/** What the relay asked, answered — pure but for the registry it is given. */
export async function answerRelay(
  registry: CommandRegistry,
  message: { id: string;
    kind: string;
    command?: string;
    params?: unknown }
): Promise<{ id: string;
  ok: true;
  result: unknown } | { id: string;
    ok: false;
    error: { code: string;
      message: string } }> {
  try {
    if ( message.kind === "list" ) {
      const commands = await registry.list();

      return {
        id: message.id,
        ok: true,
        result: commands.map( ( command ) => ( {
          id: command.id,
          title: command.title,
          description: command.description,
          params: paramsJsonSchema( command.params ),
          available: command.available,
          ...( command.reason ? {
            reason: command.reason
          } : {} )
        } ) )
      };
    }

    return {
      id: message.id,
      ok: true,
      result: await registry.execute(
        String( message.command ),
        message.params
      )
    };
  } catch( error ) {
    return {
      id: message.id,
      ok: false,
      error: error instanceof CommandError
        ? {
          code: error.code,
          message: error.message
        }
        : {
          code: "failed",
          message: error instanceof Error ? error.message : String( error )
        }
    };
  }
}

async function post(
  port: number, body: unknown
): Promise<void> {
  await fetch(
    `${ base( port ) }/message`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify( body )
    }
  );
}

/** Tell the relay what this tab shows (on connect and after each sketch mount). */
export function sayHello( sketch: string ): void {
  if ( status.state !== "connected" ) {
    return;
  }
  void post(
    status.port,
    {
      hello: {
        title: document.title,
        route: location.pathname,
        sketch
      }
    }
  ).catch( () => undefined );
}

let currentSketch = "";

/** The sketch whose commands are registered now (`engine/category/name`). */
export function getBridgeSketch(): string {
  return currentSketch;
}

export function setBridgeSketch( sketch: string ): void {
  currentSketch = sketch;
  sayHello( sketch );
}

export function disconnectBridge( message?: string ): void {
  source?.close();
  source = null;
  try {
    sessionStorage.removeItem( SESSION_KEY );
  } catch {
    // Storage blocked: nothing to forget.
  }
  setStatus( message && status.state !== "off"
    ? {
      state: "error",
      port: "port" in status ? status.port : RELAY_DEFAULT_PORT,
      message
    }
    : {
      state: "off"
    } );
}

export function connectBridge( port: number = RELAY_DEFAULT_PORT ): void {
  source?.close();
  setStatus( {
    state: "connecting",
    port
  } );

  let welcomed = false;
  const events = new EventSource( `${ base( port ) }/events` );

  source = events;
  events.addEventListener(
    "welcome",
    ( event ) => {
      welcomed = true;

      let exportsGoTo: string | undefined;

      try {
        exportsGoTo = JSON.parse( ( event as MessageEvent ).data ).exportsGoTo;
      } catch {
        exportsGoTo = undefined;
      }
      setStatus( {
        state: "connected",
        port,
        exportsGoTo
      } );
      try {
        sessionStorage.setItem(
          SESSION_KEY,
          String( port )
        );
      } catch {
        // Storage blocked: the connection simply does not survive a reload.
      }
      sayHello( currentSketch );
    }
  );
  events.addEventListener(
    "replaced",
    () => disconnectBridge( "Another tab took over the agent connection." )
  );
  events.onmessage = ( event ) => {
    let message: { id: string;
      kind: string;
      command?: string;
      params?: unknown };

    try {
      message = JSON.parse( event.data );
    } catch {
      return;
    }
    void answerRelay(
      studioCommands,
      message
    ).then( ( answer ) => post(
      port,
      answer
    ) )
      .catch( () => undefined );
  };
  events.onerror = () => {
    if ( source !== events ) {
      return;
    }
    if ( !welcomed ) {
      // Never reached: the relay is not running (or the port is wrong). Stop
      // the browser's endless retries and say so.
      events.close();
      source = null;
      setStatus( {
        state: "error",
        port,
        message: `No relay answers on 127.0.0.1:${ port }. Start it (node sketchbook-studio-mcp.mjs) and connect again.`
      } );

      return;
    }
    // Was connected: the browser retries on its own; show it.
    setStatus( {
      state: "connecting",
      port
    } );
    welcomed = false;
  };
}

/** Reconnect a tab that was connected before its reload. */
export function resumeBridge(): void {
  if ( typeof window === "undefined" || status.state !== "off" ) {
    return;
  }

  let stored: string | null = null;

  try {
    stored = sessionStorage.getItem( SESSION_KEY );
  } catch {
    stored = null;
  }

  const port = Number( stored );

  if ( Number.isInteger( port ) && port > 0 ) {
    connectBridge( port );
  }
}

/**
 * Hand a file the tab made (an export, a saved snapshot) to the relay, which
 * writes it under its output folder. Answers where it landed.
 */
export async function sendFileToRelay(
  blob: Blob, name: string, folder = ""
): Promise<{ path: string;
  bytes: number }> {
  if ( status.state !== "connected" ) {
    throw new CommandError(
      "unavailable",
      "no relay is connected to receive the file"
    );
  }

  const response = await fetch(
    `${ base( status.port ) }/file`,
    {
      method: "POST",
      headers: {
        "x-sketchbook-name": encodeURIComponent( name ),
        "x-sketchbook-folder": encodeURIComponent( folder )
      },
      body: blob
    }
  );
  const answer = await response.json().catch( () => ( {} ) ) as { path?: string;
    bytes?: number;
    error?: string };

  if ( !response.ok || !answer.path ) {
    throw new CommandError(
      "failed",
      `the relay did not write ${ name }: ${ answer.error ?? response.status }`
    );
  }

  return {
    path: answer.path,
    bytes: answer.bytes ?? blob.size
  };
}

declare global {
  interface Window {
    sketchbook?: {
      commands: () => ReturnType<CommandRegistry[ "list" ]>;
      run: ( id: string, params?: unknown ) => Promise<unknown>;
    };
  }
}

if ( typeof window !== "undefined" ) {
  window.sketchbook = {
    commands: () => studioCommands.list(),
    run: (
      id, params
    ) => studioCommands.execute(
      id,
      params
    )
  };
}
