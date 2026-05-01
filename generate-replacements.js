import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sketchesDir = path.join(
  __dirname,
  "src/templates/p5/sketches"
);

function getAllSketchFiles(dir) {
  const files = [];
  const walk = (currentPath) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "index.js") {
        files.push(fullPath);
      }
    }
  };
  walk(dir);
  return files;
}

function getRelativePath(filePath) {
  return path.relative(
    path.join(__dirname, "src/templates/p5/sketches"),
    filePath
  );
}

function analyzeSketch(content, filePath) {
  const replacements = [];
  const relativePath = getRelativePath(filePath);

  // Check if import already exists
  const hasGetP5Import = content.includes(
    'import { getP5 } from "@/p5/utils/sketch.js"'
  );

  if (!hasGetP5Import) {
    // Find the position to add import (after existing imports)
    const lines = content.split("\n");
    let importEndLine = -1;

    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].startsWith("import ") ||
        lines[i].startsWith("export ")
      ) {
        importEndLine = i;
      } else if (lines[i].trim() && !lines[i].startsWith("import")) {
        break;
      }
    }

    if (importEndLine >= 0) {
      const beforeImports = lines.slice(0, importEndLine + 1).join("\n");
      const afterImports = lines.slice(importEndLine + 1).join("\n");

      replacements.push({
        oldString: lines.slice(0, importEndLine + 1).join("\n"),
        newString:
          lines.slice(0, importEndLine + 1).join("\n") +
          '\nimport { getP5 } from "@/p5/utils/sketch.js";',
      });
    }
  }

  // Find sketch.setup() blocks
  const setupRegex =
    /sketch\.setup\s*\(\s*(?:async)?\s*(?:\(\s*(?:[^)]*)\s*\))?\s*=>\s*\{/g;
  let match;

  while ((match = setupRegex.exec(content)) !== null) {
    const startPos = match.index + match[0].length;
    const setupContent = content.substring(startPos, startPos + 500);

    // Check if p = getP5() is already there
    if (!setupContent.includes("const p = getP5()")) {
      // Find the first non-whitespace character after {
      const afterBrace = match[0];
      const indent = afterBrace.match(/\n(\s*)\{/);
      const baseIndent = indent ? indent[1] : "";
      const nextLineIndent = baseIndent + "  ";

      const oldString = match[0];
      const newString =
        oldString + "\n" + nextLineIndent + "const p = getP5();";

      replacements.push({
        oldString,
        newString,
      });
    }
  }

  // Find sketch.draw() blocks
  const drawRegex =
    /sketch\.draw\s*\(\s*\([^)]*\)\s*=>\s*\{/g;

  while ((match = drawRegex.exec(content)) !== null) {
    const startPos = match.index + match[0].length;
    const drawContent = content.substring(startPos, startPos + 500);

    if (!drawContent.includes("const p = getP5()")) {
      const indent = match[0].match(/\n(\s*)\{/);
      const baseIndent = indent ? indent[1] : "";
      const nextLineIndent = baseIndent + "  ";

      const oldString = match[0];
      const newString =
        oldString + "\n" + nextLineIndent + "const p = getP5();";

      replacements.push({
        oldString,
        newString,
      });
    }
  }

  // Find events.register() callbacks with context
  const eventsRegex = /events\.register\s*\(\s*"[^"]*"\s*,\s*(?:\([^)]*\))?\s*=>\s*\{/g;

  while ((match = eventsRegex.exec(content)) !== null) {
    const startPos = match.index + match[0].length;
    const eventContent = content.substring(startPos, startPos + 500);

    if (!eventContent.includes("const p = getP5()")) {
      const indent = match[0].match(/\n(\s*)\{/);
      const baseIndent = indent ? indent[1] : "";
      const nextLineIndent = baseIndent + "  ";

      const oldString = match[0];
      const newString =
        oldString + "\n" + nextLineIndent + "const p = getP5();";

      replacements.push({
        oldString,
        newString,
      });
    }
  }

  // Generate p5 call replacements within functions
  const p5Calls = [
    "background",
    "clear",
    "createVector",
    "createGraphics",
    "push",
    "pop",
    "translate",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "scale",
    "stroke",
    "fill",
    "color",
    "line",
    "rect",
    "circle",
    "map",
    "sin",
    "cos",
    "tan",
    "sqrt",
    "random",
    "noise",
    "loadImage",
    "beginShape",
    "vertex",
    "endShape",
    "lerp",
    "constrain",
  ];

  // This is a simplified approach - generate replacement pairs for common patterns
  for (const call of p5Calls) {
    const regex = new RegExp(`\\b${call}\\s*\\(`, "g");
    let callMatch;

    while ((callMatch = regex.exec(content)) !== null) {
      const beforeContext = content.substring(
        Math.max(0, callMatch.index - 100),
        callMatch.index
      );
      const afterContext = content.substring(
        callMatch.index,
        Math.min(content.length, callMatch.index + 150)
      );

      // Skip if already using p.
      if (beforeContext.includes("p.")) {
        continue;
      }

      // Skip if in comments
      if (beforeContext.includes("//")) {
        continue;
      }

      // Get 3-5 lines of context
      const lines = content.substring(
        Math.max(0, callMatch.index - 300),
        Math.min(content.length, callMatch.index + 300)
      );

      const linesBefore = lines.split("\n").slice(0, -1).slice(-3).join("\n");
      const linesAfter = lines.split("\n").slice(1).slice(0, 3).join("\n");

      const oldPatternLine = content.substring(
        callMatch.index,
        callMatch.index + call.length + 2
      );

      // Only add if not already p-prefixed
      if (!oldPatternLine.startsWith("p.")) {
        // We'll create these replacements more carefully later
        // For now, just note them
      }
    }
  }

  return {
    path: relativePath,
    replacements: replacements.slice(0, 20), // Limit per sketch for now
  };
}

async function main() {
  const allFiles = getAllSketchFiles(sketchesDir).filter(
    (f) => !f.includes("neon-graffiti")
  );

  console.log(`Found ${allFiles.length} sketch files`);

  const sketches = [];

  for (const filePath of allFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const analysis = analyzeSketch(content, filePath);
      sketches.push(analysis);
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  }

  const output = {
    sketches,
  };

  console.log(
    JSON.stringify(output, null, 2)
  );
}

main();
