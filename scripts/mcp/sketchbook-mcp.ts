#!/usr/bin/env node
/**
 * Sketchbook's MCP server — stdio, no dependency beyond the repo's own
 * Playwright. Run from a checkout (Node >= 22.18 runs this TypeScript as-is):
 *
 *   node scripts/mcp/sketchbook-mcp.ts
 *
 * It drives a RUNNING Sketchbook over its public routes (`npm run dev` here,
 * or the deployed one), and renders single frames itself in headless Chromium
 * against that server's `/embed` route. Configuration, all optional:
 *
 *   SKETCHBOOK_URL          the server (default http://localhost:3000)
 *   SKETCHBOOK_OUTPUT_DIR   where saved frames and videos land
 *                           (default <tmp>/sketchbook-mcp)
 *   PW_CHROMIUM             a Chromium binary, when Playwright's is not installed
 *
 * stdout carries JSON-RPC only; everything else goes to stderr.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import {
  fileURLToPath
} from "node:url";

import type {
  CatalogEntry
} from "./catalog.ts";
import {
  createCommands
} from "./commands.ts";
import {
  FrameRenderer
} from "./frameRenderer.ts";
import {
  handleMessage, type JsonRpcMessage
} from "./protocol.ts";
import {
  createCommandRegistry
} from "./registry.ts";

const ROOT = path.resolve(
  path.dirname( fileURLToPath( import.meta.url ) ),
  "../.."
);
const SKETCHES = path.join(
  ROOT,
  "src/sketches"
);
const baseUrl = ( process.env.SKETCHBOOK_URL ?? "http://localhost:3000" ).replace(
  /\/+$/,
  ""
);
const outputDir = process.env.SKETCHBOOK_OUTPUT_DIR ?? path.join(
  os.tmpdir(),
  "sketchbook-mcp"
);
const frames = new FrameRenderer( baseUrl );
const registry = createCommandRegistry();

function log( ...parts: unknown[] ): void {
  process.stderr.write( `[sketchbook-mcp] ${ parts.join( " " ) }\n` );
}

registry.register( createCommands( {
  baseUrl,
  fetch: globalThis.fetch,
  // The generated catalogue of this checkout — the gallery's own list.
  catalog: async() => JSON.parse( await fs.readFile(
    path.join(
      SKETCHES,
      "metadata.json"
    ),
    "utf8"
  ) ) as CatalogEntry[],
  localOptions: async( entry ) => {
    const file = path.join(
      SKETCHES,
      entry.engine,
      "sketches",
      ...( entry.category ? [
        entry.category
      ] : [] ),
      entry.name,
      "options.json"
    );

    try {
      return JSON.parse( await fs.readFile(
        file,
        "utf8"
      ) );
    } catch {
      return null;
    }
  },
  renderFrame: ( request ) => frames.render( request ),
  outputDir,
  writeFile: async(
    file, bytes
  ) => {
    await fs.mkdir(
      path.dirname( file ),
      {
        recursive: true
      }
    );
    await fs.writeFile(
      file,
      bytes
    );
  },
  sleep: ( ms ) => new Promise( ( resolve ) => setTimeout(
    resolve,
    ms
  ) ),
  now: () => Date.now()
} ) );

// The frame renderer writes its PNG itself, so the directory must exist first.
await fs.mkdir(
  outputDir,
  {
    recursive: true
  }
);

const input = readline.createInterface( {
  input: process.stdin
} );

function send( message: unknown ): void {
  process.stdout.write( `${ JSON.stringify( message ) }\n` );
}

input.on(
  "line",
  ( line ) => {
    if ( !line.trim() ) {
      return;
    }

    let message: JsonRpcMessage;

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

    // Calls run concurrently: a render or a jobs.wait must not hold up a ping.
    handleMessage(
      registry,
      message
    ).then(
      ( answer ) => {
        if ( answer ) {
          send( answer );
        }
      },
      ( error: unknown ) => log(
        "unhandled:",
        error instanceof Error ? error.stack : String( error )
      )
    );
  }
);

async function shutdown(): Promise<void> {
  await frames.close();
  process.exit( 0 );
}

input.on(
  "close",
  () => void shutdown()
);
process.on(
  "SIGINT",
  () => void shutdown()
);
process.on(
  "SIGTERM",
  () => void shutdown()
);

log( `ready — ${ baseUrl }, files in ${ outputDir }` );
