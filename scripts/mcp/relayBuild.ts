/**
 * The served relay is GENERATED: `scripts/mcp/studioRelay.ts` (one file, Node
 * imports only) compiled to plain JavaScript by the TypeScript compiler the
 * repository locks, so the output is the same on every machine — Node's own
 * type stripping is still experimental and free to change. `npm run
 * mcp:relay:write` writes it; `__tests__/studioRelay.test.ts` fails when the
 * committed file drifts from its source.
 */

import {
  DEFAULT_ORIGINS, RELAY_TOOLS, RELAY_VERSION
} from "./studioRelay.ts";
import {
  zipStore
} from "./zipStore.ts";

export const RELAY_SOURCE = "scripts/mcp/studioRelay.ts";
export const RELAY_OUTPUT = "public/mcp/sketchbook-studio-mcp.mjs";
/**
 * The same relay as a Claude Desktop extension: a ZIP of `manifest.json` and
 * the relay, which Claude Desktop installs from a dialog when the file is
 * opened — no terminal, no Node path to type (it runs it with its own Node).
 */
export const BUNDLE_OUTPUT = "public/mcp/sketchbook-studio.mcpb";
const BUNDLE_ENTRY = "server/sketchbook-studio-mcp.mjs";

type TypeScript = {
  transpileModule: ( input: string, options: Record<string, unknown> ) => { outputText: string };
  ModuleKind: { ESNext: number };
  ScriptTarget: { ES2022: number };
};

export function buildRelay(
  source: string, ts: TypeScript
): string {
  const {
    outputText
  } = ts.transpileModule(
    source,
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        removeComments: false
      }
    }
  );

  return [
    "#!/usr/bin/env node",
    `// GENERATED from ${ RELAY_SOURCE } by \`npm run mcp:relay:write\` — do not edit by hand.`,
    "// Sketchbook's studio relay (MCP level 1): run it with Node >= 18 and connect a studio tab.",
    outputText.trimEnd(),
    ""
  ].join( "\n" );
}

/** The extension's manifest (MCPB format, as Atelier's `mcpbManifest`). */
export function bundleManifest(): Record<string, unknown> {
  const homepage = `${ DEFAULT_ORIGINS[ 0 ] }/`;

  return {
    manifest_version: "0.3",
    name: "sketchbook-studio",
    display_name: "Sketchbook studio",
    version: RELAY_VERSION,
    description: "Drive the Sketchbook studio tab open in your browser — parameters, slides, text, HUD, media, snapshots and exports — from Claude.",
    long_description: "Sketchbook runs its studio in your browser. This extension is the small relay between Claude and the studio tab you connect from its menu (Connect an agent): it listens on 127.0.0.1 only, answers only Sketchbook's own pages, and writes an agent's exports into ~/Movies/Sketchbook, never over an existing file. Every change goes through the studio's own controls and lands in its undo history.",
    author: {
      name: "Steeve Pommier",
      url: homepage
    },
    homepage,
    server: {
      type: "node",
      entry_point: BUNDLE_ENTRY,
      mcp_config: {
        command: "node",
        args: [
          `\${__dirname}/${ BUNDLE_ENTRY }`
        ]
      }
    },
    tools: RELAY_TOOLS.map( ( tool ) => ( {
      name: tool.name,
      description: tool.description
    } ) ),
    keywords: [
      "creative-coding",
      "p5js",
      "generative",
      "motion",
      "sketchbook"
    ]
  };
}

/** The `.mcpb` bytes for a built relay — reproducible, so drift-testable. */
export function buildBundle( relay: string ): Uint8Array {
  return zipStore( [
    {
      name: "manifest.json",
      data: `${ JSON.stringify(
        bundleManifest(),
        null,
        2
      ) }\n`
    },
    {
      name: BUNDLE_ENTRY,
      data: relay
    }
  ] );
}
