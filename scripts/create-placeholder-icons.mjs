#!/usr/bin/env node

/**
 * This script creates simple placeholder SVG icons that can be used temporarily
 * Replace these with proper PNG icons for production
 */

import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";

const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );
const publicDir = path.join(
  __dirname,
  "..",
  "public"
);

// Create a simple SVG icon
function createSVGIcon(
  size, text
) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${ size }" height="${ size }" viewBox="0 0 ${ size } ${ size }" xmlns="http://www.w3.org/2000/svg">
  <rect width="${ size }" height="${ size }" fill="#6366f1"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${ size * 0.4 }" fill="white" text-anchor="middle" dominant-baseline="central">
    ${ text }
  </text>
</svg>`;
}

console.log( "Creating placeholder SVG icons...\n" );

// Create 192x192 icon
const icon192 = createSVGIcon(
  192,
  "P5"
);

fs.writeFileSync(
  path.join(
    publicDir,
    "icon-192x192.svg"
  ),
  icon192
);
console.log( "✓ Created icon-192x192.svg" );

// Create 512x512 icon
const icon512 = createSVGIcon(
  512,
  "P5"
);

fs.writeFileSync(
  path.join(
    publicDir,
    "icon-512x512.svg"
  ),
  icon512
);
console.log( "✓ Created icon-512x512.svg" );

console.log( "\n⚠️  Note: These are SVG placeholders." );
console.log( "For production, create proper PNG files:" );
console.log( "  - icon-192x192.png" );
console.log( "  - icon-512x512.png" );
console.log( "\nYou can convert SVG to PNG using:" );
console.log( "  - Online tools like CloudConvert" );
console.log( "  - ImageMagick: convert icon-192x192.svg icon-192x192.png" );
console.log( "  - Or use the instructions in public/ICON_INSTRUCTIONS.md\n" );
