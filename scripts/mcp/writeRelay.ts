/** Regenerate the served relay: `npm run mcp:relay:write` (see `relayBuild.ts`). */
import fs from "node:fs";
import {
  createRequire
} from "node:module";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";

import {
  BUNDLE_OUTPUT, buildBundle, buildRelay, RELAY_OUTPUT, RELAY_SOURCE
} from "./relayBuild.ts";

const root = path.resolve(
  path.dirname( fileURLToPath( import.meta.url ) ),
  "../.."
);
const ts = createRequire( import.meta.url )( "typescript" );
const output = buildRelay(
  fs.readFileSync(
    path.join(
      root,
      RELAY_SOURCE
    ),
    "utf8"
  ),
  ts
);

fs.writeFileSync(
  path.join(
    root,
    RELAY_OUTPUT
  ),
  output,
  {
    mode: 0o755
  }
);
process.stdout.write( `wrote ${ RELAY_OUTPUT } (${ output.length } bytes)\n` );

const bundle = buildBundle( output );

fs.writeFileSync(
  path.join(
    root,
    BUNDLE_OUTPUT
  ),
  bundle
);
process.stdout.write( `wrote ${ BUNDLE_OUTPUT } (${ bundle.length } bytes)\n` );
