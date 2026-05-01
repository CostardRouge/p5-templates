#!/usr/bin/env node
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

function getContextLines(content, startIndex, lineCount = 3) {
  const before = content.substring(0, startIndex);
  const beforeLines = before.split("\n");
  const afterIndex = startIndex;
  const after = content.substring(afterIndex);
  const afterLines = after.split("\n");

  const startLine = Math.max(0, beforeLines.length - lineCount - 1);
  const endLine = afterLines.length > lineCount ? lineCount : afterLines.length;

  const beforeContext = beforeLines.slice(startLine).join("\n");
  const afterContext = afterLines.slice(0, endLine).join("\n");

  return (beforeContext + "\n" + afterContext).trim();
}

function analyzeSketch(content, filePath) {
  const replacements = [];
  const relativePath = getRelativePath(filePath);
  const lines = content.split("\n");

  // 1. Check and add import statement
  const hasGetP5Import = content.includes(
    'import { getP5 } from "@/p5/utils/sketch.js"'
  );

  if (!hasGetP5Import) {
    // Find the last import statement
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s+/)) {
        lastImportLine = i;
      }
    }

    if (lastImportLine >= 0) {
      const oldImportBlock = lines.slice(0, lastImportLine + 1).join("\n");
      const newImportBlock =
        oldImportBlock + '\nimport { getP5 } from "@/p5/utils/sketch.js";';

      replacements.push({
        oldString: oldImportBlock,
        newString: newImportBlock,
      });
    }
  }

  // 2. Add const p = getP5() to sketch.setup() blocks
  const setupMatches = [...content.matchAll(
    /sketch\.setup\s*\(\s*(?:async)?\s*(?:\(\s*[^)]*\s*\))?\s*=>\s*\{/g
  )];

  for (const match of setupMatches) {
    const startIdx = match.index + match[0].length;
    const nextLines = content.substring(startIdx, startIdx + 200);

    if (!nextLines.includes("const p = getP5()")) {
      // Find how many lines ahead the first line is
      const indent = match[0].match(/\n(\s*)\{|\{/);
      const baseIndent = indent ? (indent[1] || "") : "  ";

      replacements.push({
        oldString: match[0],
        newString: match[0] + "\n" + baseIndent + "  const p = getP5();",
      });
    }
  }

  // 3. Add const p = getP5() to sketch.draw() blocks
  const drawMatches = [...content.matchAll(
    /sketch\.draw\s*\(\s*\([^)]*\)\s*=>\s*\{/g
  )];

  for (const match of drawMatches) {
    const startIdx = match.index + match[0].length;
    const nextLines = content.substring(startIdx, startIdx + 200);

    if (!nextLines.includes("const p = getP5()")) {
      const indent = match[0].match(/\n(\s*)\{|\{/);
      const baseIndent = indent ? (indent[1] || "") : "  ";

      replacements.push({
        oldString: match[0],
        newString: match[0] + "\n" + baseIndent + "  const p = getP5();",
      });
    }
  }

  // 4. Add const p = getP5() to events.register callbacks
  const eventMatches = [...content.matchAll(
    /events\.register\s*\(\s*"[^"]*"\s*,\s*(?:\([^)]*\))?\s*=>\s*\{/g
  )];

  for (const match of eventMatches) {
    const startIdx = match.index + match[0].length;
    const nextLines = content.substring(startIdx, startIdx + 200);

    if (!nextLines.includes("const p = getP5()")) {
      const indent = match[0].match(/\n(\s*)\{|\{/);
      const baseIndent = indent ? (indent[1] || "") : "  ";

      replacements.push({
        oldString: match[0],
        newString: match[0] + "\n" + baseIndent + "  const p = getP5();",
      });
    }
  }

  // 5. Replace bare p5 calls with p. prefix
  const p5Methods = [
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
    "noStroke",
    "noFill",
    "noSmooth",
    "text",
    "strokeWeight",
    "pixelDensity",
    "erase",
    "noErase",
    "point",
    "noiseSeed",
    "noiseDetail",
  ];

  for (const method of p5Methods) {
    // Find all occurrences of method(
    const regex = new RegExp(`\\b${method}\\s*\\(`, "g");
    let match;

    while ((match = regex.exec(content)) !== null) {
      const before = content.substring(Math.max(0, match.index - 50), match.index);

      // Skip if already using p. or Math.
      if (before.includes("p.") || before.includes("Math.")) {
        continue;
      }

      // Skip if in comment
      if (before.includes("//")) {
        continue;
      }

      // Get context (3 lines before and after)
      const startIdx = Math.max(0, match.index - 300);
      const endIdx = Math.min(content.length, match.index + 300);
      const contextBlock = content.substring(startIdx, endIdx);

      const methodCall = method + "(";
      const pMethodCall = "p." + method + "(";

      // Only add if it's the actual old string
      if (contextBlock.includes(methodCall)) {
        // Find the exact context with 3-5 lines before and after
        const linesArray = content.split("\n");
        let lineNum = content.substring(0, match.index).split("\n").length - 1;

        const contextStart = Math.max(0, lineNum - 3);
        const contextEnd = Math.min(linesArray.length, lineNum + 4);

        const beforeContext = linesArray.slice(contextStart, lineNum).join("\n");
        const currentLine = linesArray[lineNum];
        const afterContext = linesArray.slice(lineNum + 1, contextEnd).join("\n");

        const oldString = beforeContext + "\n" + currentLine + "\n" + afterContext;
        const newString =
          beforeContext +
          "\n" +
          currentLine.replace(
            new RegExp(`\\b${method}\\s*\\(`, "g"),
            "p." + method + "("
          ) +
          "\n" +
          afterContext;

        // Avoid duplicate replacements
        const isDuplicate = replacements.some(
          (r) => r.oldString.includes(method) && r.newString.includes("p." + method)
        );

        if (!isDuplicate) {
          replacements.push({
            oldString,
            newString,
          });
        }
      }
    }
  }

  // 6. Replace p5 constants
  const constants = [
    { old: "PI", new: "p.PI" },
    { old: "TWO_PI", new: "p.TWO_PI" },
    { old: "HALF_PI", new: "p.HALF_PI" },
    { old: "TAU", new: "p.TAU" },
  ];

  for (const { old, new: newConst } of constants) {
    const regex = new RegExp(`\\b${old}\\b`, "g");
    let match;

    while ((match = regex.exec(content)) !== null) {
      const before = content.substring(Math.max(0, match.index - 50), match.index);

      // Skip if already using p. or in comment
      if (before.includes("p." + old) || before.includes("//")) {
        continue;
      }

      // Get context (3 lines before and after)
      const linesArray = content.split("\n");
      let lineNum = content.substring(0, match.index).split("\n").length - 1;

      const contextStart = Math.max(0, lineNum - 3);
      const contextEnd = Math.min(linesArray.length, lineNum + 4);

      const beforeContext = linesArray.slice(contextStart, lineNum).join("\n");
      const currentLine = linesArray[lineNum];
      const afterContext = linesArray.slice(lineNum + 1, contextEnd).join("\n");

      const oldString = beforeContext + "\n" + currentLine + "\n" + afterContext;
      const newString =
        beforeContext +
        "\n" +
        currentLine.replace(new RegExp(`\\b${old}\\b`), newConst) +
        "\n" +
        afterContext;

      // Avoid duplicates
      const isDuplicate = replacements.some(
        (r) => r.oldString === oldString
      );

      if (!isDuplicate) {
        replacements.push({
          oldString,
          newString,
        });
      }
    }
  }

  return {
    path: relativePath,
    replacements: replacements.slice(0, 50), // Limit per sketch
  };
}

async function main() {
  const allFiles = getAllSketchFiles(sketchesDir).filter(
    (f) => !f.includes("neon-graffiti")
  );

  console.error(`Processing ${allFiles.length} sketch files...`);

  const sketches = [];

  for (const filePath of allFiles.sort()) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const analysis = analyzeSketch(content, filePath);
      sketches.push(analysis);
      console.error(
        `✓ ${analysis.path} (${analysis.replacements.length} replacements)`
      );
    } catch (error) {
      console.error(`✗ Error processing ${filePath}:`, error.message);
    }
  }

  const output = {
    sketches,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
