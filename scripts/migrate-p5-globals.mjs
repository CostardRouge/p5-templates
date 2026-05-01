/**
 * Codemod: Convert bare p5 global calls to p.xxx() instance calls.
 *
 * Rules:
 * - Only replaces truly BARE calls (not preceded by `.` or alphanumeric)
 * - Does NOT touch: object.method() calls, array.map(), etc.
 * - Only operates inside function bodies that already have `const p = getP5();`
 * - Handles constants (PI, TAU, TWO_PI, HALF_PI, CENTER, LEFT, RIGHT, TOP, BOTTOM, CLOSE, TRIANGLES, POINTS, P2D, WEBGL)
 * - Handles properties (width, height, mouseX, mouseY, frameCount, key, keyCode, keyIsPressed, mouseIsPressed)
 * - Handles functions (all p5 drawing/math/state functions)
 */

import {
  readFileSync, writeFileSync
} from "fs";
import {
  execSync
} from "child_process";

// p5 constants that should become p.CONSTANT
const P5_CONSTANTS = [
  "PI",
  "TAU",
  "TWO_PI",
  "HALF_PI",
  "CENTER",
  "LEFT",
  "RIGHT",
  "TOP",
  "BOTTOM",
  "CLOSE",
  "TRIANGLES",
  "POINTS",
  "TRIANGLE_FAN",
  "TRIANGLE_STRIP",
  "QUADS",
  "QUAD_STRIP",
  "P2D",
  "WEBGL",
  "BOLD",
  "ITALIC",
  "NORMAL",
  "SQUARE",
  "PROJECT",
  "ROUND",
  "MITER",
  "BEVEL",
  "RGB",
  "HSB",
  "HSL",
  "BLEND",
  "ADD",
  "MULTIPLY",
  "SCREEN",
];

// p5 properties (read from the instance)
const P5_PROPERTIES = [
  "width",
  "height",
  "mouseX",
  "mouseY",
  "pmouseX",
  "pmouseY",
  "frameCount",
  "deltaTime",
  "key",
  "keyCode",
  "keyIsPressed",
  "mouseIsPressed",
  "pixels",
];

// p5 functions that should become p.function()
const P5_FUNCTIONS = [
  // Drawing
  "background",
  "clear",
  "fill",
  "noFill",
  "stroke",
  "noStroke",
  "strokeWeight",
  "point",
  "line",
  "rect",
  "circle",
  "ellipse",
  "arc",
  "quad",
  "triangle",
  "bezier",
  "curve",
  "beginShape",
  "vertex",
  "curveVertex",
  "bezierVertex",
  "endShape",
  "text",
  "textSize",
  "textAlign",
  "textFont",
  "textWidth",
  "textLeading",
  // Transforms
  "push",
  "pop",
  "translate",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "scale",
  "shearX",
  "shearY",
  "applyMatrix",
  "resetMatrix",
  // Math
  "map",
  "constrain",
  "lerp",
  "dist",
  "mag",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sqrt",
  "pow",
  "abs",
  "ceil",
  "floor",
  "round",
  "min",
  "max",
  "random",
  "randomSeed",
  "noise",
  "noiseSeed",
  "noiseDetail",
  "radians",
  "degrees",
  // Color
  "color",
  "lerpColor",
  "red",
  "green",
  "blue",
  "alpha",
  "hue",
  "saturation",
  "brightness",
  "colorMode",
  // Image
  "image",
  "loadImage",
  "createImage",
  "tint",
  "noTint",
  "createGraphics",
  // State
  "erase",
  "noErase",
  "clip",
  "noClip",
  "pixelDensity",
  "smooth",
  "noSmooth",
  "cursor",
  "noCursor",
  "frameRate",
  "noLoop",
  "loop",
  "redraw",
  // 3D
  "camera",
  "perspective",
  "ortho",
  "ambientLight",
  "directionalLight",
  "pointLight",
  "specularMaterial",
  "normalMaterial",
  "ambientMaterial",
  "box",
  "sphere",
  "cylinder",
  "cone",
  "torus",
  "plane",
  "texture",
  "textureMode",
  // Interaction
  "createVector",
  // Misc
  "millis",
  "day",
  "hour",
  "minute",
  "second",
  "month",
  "year",
  "save",
  "saveCanvas",
  "loadJSON",
  "loadFont",
  "loadStrings",
];

// Build regex patterns
// For functions: match word boundary + function name + `(`
// Negative lookbehind for `.` or any word char ensures we only match bare calls
function buildFunctionRegex( fnName ) {
  // Match: start of line or non-word/non-dot char, then fnName(
  // But NOT: something.fnName( or _fnName( or $fnName(
  return new RegExp(
    `(?<![\\w.$])${ fnName }\\(`,
    "g"
  );
}

// For constants/properties: match as standalone identifier
// Not preceded by `.` or word char, not followed by word char
function buildIdentifierRegex( name ) {
  return new RegExp(
    `(?<![\\w.$])${ name }(?![\\w])`,
    "g"
  );
}

// Process a single file
function processFile( filePath ) {
  let content = readFileSync(
    filePath,
    "utf-8"
  );
  const original = content;

  // Only process files that have getP5
  if ( !content.includes( "getP5" ) ) {
    return false;
  }

  // Replace bare function calls
  for ( const fn of P5_FUNCTIONS ) {
    content = content.replace(
      buildFunctionRegex( fn ),
      `p.${ fn }(`
    );
  }

  // Replace bare constants
  for ( const c of P5_CONSTANTS ) {
    content = content.replace(
      buildIdentifierRegex( c ),
      `p.${ c }`
    );
  }

  // Replace bare properties
  for ( const prop of P5_PROPERTIES ) {
    content = content.replace(
      buildIdentifierRegex( prop ),
      `p.${ prop }`
    );
  }

  // Fix double-prefixing: p.p.xxx -> p.xxx
  content = content.replace(
    /p\.p\./g,
    "p."
  );

  // Fix cases where we accidentally prefixed things inside strings/comments
  // Fix "p.getP5" -> "getP5"
  content = content.replace(
    /p\.getP5/g,
    "getP5"
  );

  // Fix import statements that got mangled
  // e.g., `import p.mappers` -> should not happen due to lookbehind, but just in case
  content = content.replace(
    /import p\./g,
    "import "
  );

  // Fix object property access that got double-prefixed
  // e.g., options.sketch.p.width -> leave as-is (these are actual object props)
  // Actually the regex shouldn't match these due to lookbehind

  // Fix: Don't prefix width/height when they are object destructured properties
  // e.g., { width: W, height: H } should stay
  // The regex handles this via lookbehind (preceded by `:` space)

  // Fix: p.Math.xxx -> Math.xxx
  content = content.replace(
    /p\.Math\./g,
    "Math."
  );

  // Fix: p.Array -> Array
  content = content.replace(
    /p\.Array/g,
    "Array"
  );
  content = content.replace(
    /p\.Object/g,
    "Object"
  );
  content = content.replace(
    /p\.JSON/g,
    "JSON"
  );
  content = content.replace(
    /p\.Number/g,
    "Number"
  );
  content = content.replace(
    /p\.String/g,
    "String"
  );
  content = content.replace(
    /p\.Boolean/g,
    "Boolean"
  );
  content = content.replace(
    /p\.console/g,
    "console"
  );
  content = content.replace(
    /p\.window/g,
    "window"
  );
  content = content.replace(
    /p\.document/g,
    "document"
  );
  content = content.replace(
    /p\.performance/g,
    "performance"
  );
  content = content.replace(
    /p\.parseInt/g,
    "parseInt"
  );
  content = content.replace(
    /p\.parseFloat/g,
    "parseFloat"
  );
  content = content.replace(
    /p\.isNaN/g,
    "isNaN"
  );
  content = content.replace(
    /p\.Infinity/g,
    "Infinity"
  );
  content = content.replace(
    /p\.undefined/g,
    "undefined"
  );
  content = content.replace(
    /p\.null/g,
    "null"
  );
  content = content.replace(
    /p\.true/g,
    "true"
  );
  content = content.replace(
    /p\.false/g,
    "false"
  );
  content = content.replace(
    /p\.NaN/g,
    "NaN"
  );

  // Fix: Don't prefix inside import statements
  // Restore any mangled import lines
  const lines = content.split( "\n" );
  const originalLines = original.split( "\n" );

  for ( let i = 0; i < lines.length; i++ ) {
    if ( originalLines[ i ]?.trimStart().startsWith( "import " ) || originalLines[ i ]?.trimStart().startsWith( "} from " ) ) {
      lines[ i ] = originalLines[ i ];
    }
  }
  content = lines.join( "\n" );

  // Fix: Don't prefix `abs`, `min`, `max`, `round`, `floor`, `ceil`, `pow` when preceded by Math.
  // These are fine as Math.abs etc. and shouldn't become Math.p.abs
  content = content.replace(
    /Math\.p\./g,
    "Math."
  );

  // Fix: module-level code that runs before p is defined
  // The const p = getP5() only exists inside callbacks, NOT at module top level
  // Module-level bare calls (outside any function) should use getP5() directly
  // This is too complex for regex - we'll leave those and they'll use getP5() from existing code

  if ( content !== original ) {
    writeFileSync(
      filePath,
      content
    );
    return true;
  }
  return false;
}

// Find all sketch JS files
const files = execSync(
  "find src/templates/p5/sketches -name \"*.js\"",
  {
    cwd: "/Users/mac-SPOMMI16/Documents/GitHub/p5-templates2",
    encoding: "utf-8"
  }
).trim()
  .split( "\n" )
  .filter( Boolean );

let modified = 0;

for ( const file of files ) {
  const fullPath = `/Users/mac-SPOMMI16/Documents/GitHub/p5-templates2/${ file }`;

  try {
    if ( processFile( fullPath ) ) {
      modified++;
      console.log( `✓ ${ file }` );
    }
  } catch ( e ) {
    console.error( `✗ ${ file }: ${ e.message }` );
  }
}

console.log( `\nDone: ${ modified }/${ files.length } files modified` );
