/**
 * The served relay is GENERATED: `scripts/mcp/studioRelay.ts` (one file, Node
 * imports only) compiled to plain JavaScript by the TypeScript compiler the
 * repository locks, so the output is the same on every machine — Node's own
 * type stripping is still experimental and free to change. `npm run
 * mcp:relay:write` writes it; `__tests__/studioRelay.test.ts` fails when the
 * committed file drifts from its source.
 */

export const RELAY_SOURCE = "scripts/mcp/studioRelay.ts";
export const RELAY_OUTPUT = "public/mcp/sketchbook-studio-mcp.mjs";

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
