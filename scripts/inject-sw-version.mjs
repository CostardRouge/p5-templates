#!/usr/bin/env node

/**
 * Inject cache version into service worker
 * This script runs during build to ensure cache invalidation on deployment
 */

import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";
import crypto from "crypto";

const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

const swPath = path.join(
  __dirname,
  "..",
  "public",
  "sw.js"
);
const packageJsonPath = path.join(
  __dirname,
  "..",
  "package.json"
);

// Read package.json to get version
const packageJson = JSON.parse( fs.readFileSync(
  packageJsonPath,
  "utf8"
) );
const appVersion = packageJson.version || "0.1.0";

// Generate a unique build hash based on timestamp
const buildTimestamp = Date.now();
const buildHash = crypto.createHash( "md5" ).update( buildTimestamp.toString() )
  .digest( "hex" )
  .substring(
    0,
    8
  );

// Combine app version with build hash
const cacheVersion = `${ appVersion }-${ buildHash }`;

console.log( `[Build] Injecting cache version: ${ cacheVersion }` );

// Read service worker file
let swContent = fs.readFileSync(
  swPath,
  "utf8"
);

// Replace placeholder with actual version
swContent = swContent.replace(
  "__CACHE_VERSION__",
  cacheVersion
);

// Write back to file
fs.writeFileSync(
  swPath,
  swContent,
  "utf8"
);

console.log( `[Build] ✓ Service worker updated with version ${ cacheVersion }` );
console.log( "[Build] ✓ Old caches will be automatically cleared on activation" );
