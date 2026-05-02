import fs from "node:fs";
import path from "node:path";
import {
  findSketchMeta
} from "@/engines/metadata";

function getOptionsFilePath(
  sketchName: string, engineId: string
): string | null {
  const meta = findSketchMeta(
    sketchName,
    engineId
  );

  if ( !meta ) return null;

  return path.join(
    process.cwd(),
    "src",
    "templates",
    engineId,
    "sketches",
    meta.sketchPath,
    "options.ts"
  );
}

// ---------------------------------------------------------------------------
// Deep diff – returns only the leaf paths whose value changed.
// Plain objects are recursed into; arrays and scalars are leaves.
// ---------------------------------------------------------------------------

type PathChange = {
  path: string[];
  newValue: unknown;
};

function deepDiff(
  original: unknown,
  updated: unknown,
  currentPath: string[] = [
  ]
): PathChange[] {
  if (
    typeof original === "object" &&
    original !== null &&
    !Array.isArray( original ) &&
    typeof updated === "object" &&
    updated !== null &&
    !Array.isArray( updated )
  ) {
    const changes: PathChange[] = [
    ];
    const allKeys = new Set( [
      ...Object.keys( original as Record<string, unknown> ),
      ...Object.keys( updated as Record<string, unknown> ),
    ] );

    for ( const key of allKeys ) {
      changes.push( ...deepDiff(
        ( original as Record<string, unknown> )[ key ],
        ( updated as Record<string, unknown> )[ key ],
        [
          ...currentPath,
          key
        ]
      ) );
    }

    return changes;
  }

  if ( JSON.stringify( original ) !== JSON.stringify( updated ) ) {
    return [
      {
        path: currentPath,
        newValue: updated
      }
    ];
  }

  return [
  ];
}

// ---------------------------------------------------------------------------
// File-text navigation helpers
// ---------------------------------------------------------------------------

/** Find the position of the matching closing `}` for the `{` at openBracePos. */
function findObjectClose(
  content: string, openBracePos: number
): number {
  let depth = 0;

  for ( let i = openBracePos; i < content.length; i++ ) {
    if ( content[ i ] === "{" ) depth++;
    else if ( content[ i ] === "}" ) {
      depth--;
      if ( depth === 0 ) return i;
    }
  }

  return -1;
}

/**
 * Find the end position (exclusive) of a value starting at `pos`.
 * Handles: objects, arrays, strings, numbers, booleans, null,
 * and arbitrary expressions (e.g. Math.PI / 16) as a fallback.
 */
function findValueEnd(
  content: string, pos: number
): number {
  const ch = content[ pos ];

  // Object
  if ( ch === "{" ) {
    const close = findObjectClose(
      content,
      pos
    );

    return close === -1 ? content.length : close + 1;
  }

  // Array
  if ( ch === "[" ) {
    let depth = 0;

    for ( let i = pos; i < content.length; i++ ) {
      if ( content[ i ] === "[" ) depth++;
      else if ( content[ i ] === "]" ) {
        depth--;
        if ( depth === 0 ) return i + 1;
      }
    }

    return content.length;
  }

  // String literal (single / double / template)
  if ( ch === "\"" || ch === "'" || ch === "`" ) {
    const quote = ch;
    let i = pos + 1;

    while ( i < content.length ) {
      if ( content[ i ] === "\\" ) { i += 2; continue; }
      if ( content[ i ] === quote ) return i + 1;
      i++;
    }

    return content.length;
  }

  // Number (including negative / scientific)
  const numMatch = content.slice( pos ).match( /^-?[\d.]+(?:[eE][+-]?\d+)?/ );

  if ( numMatch ) return pos + numMatch[ 0 ].length;

  // Boolean / null / undefined
  const kwMatch = content.slice( pos ).match( /^(?:true|false|null|undefined)\b/ );

  if ( kwMatch ) return pos + kwMatch[ 0 ].length;

  // Fallback: arbitrary expression – scan to the next unmatched , } ] )
  let depth = 0;

  for ( let i = pos; i < content.length; i++ ) {
    const c = content[ i ];

    if ( c === "{" || c === "[" || c === "(" ) depth++;
    else if ( c === "}" || c === "]" || c === ")" ) {
      if ( depth === 0 ) {
        let end = i;

        while ( end > pos && /\s/.test( content[ end - 1 ] ) ) end--;

        return end;
      }

      depth--;
    } else if ( c === "," && depth === 0 ) {
      let end = i;

      while ( end > pos && /\s/.test( content[ end - 1 ] ) ) end--;

      return end;
    }
  }

  return content.length;
}

/**
 * Within `content[innerStart, innerEnd)` (the inside of an object literal),
 * find the value range of `key` at depth 0 (direct property of this object).
 * Correctly skips strings, nested {}/[] blocks, and spread syntax (`...ident`).
 */
function findKeyAtDepth0(
  content: string,
  innerStart: number,
  innerEnd: number,
  key: string
): {
 valueStart: number; valueEnd: number
} | null {
  let i = innerStart;
  let depth = 0;

  while ( i < innerEnd ) {
    const ch = content[ i ];

    // Skip string literals entirely
    if ( ch === "\"" || ch === "'" || ch === "`" ) {
      const quote = ch;

      i++;

      while ( i < innerEnd ) {
        if ( content[ i ] === "\\" ) { i += 2; continue; }
        if ( content[ i ] === quote ) { i++; break; }
        i++;
      }

      continue;
    }

    if ( ch === "{" || ch === "[" ) { depth++; i++; continue; }
    if ( ch === "}" || ch === "]" ) { depth--; i++; continue; }

    if ( depth === 0 ) {
      // Try to match `key:` at the current position
      const slice = content.slice( i );
      const match = slice.match( /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/ );

      if ( match && match[ 1 ] === key ) {
        let valueStart = i + match[ 0 ].length;

        // Skip leading whitespace
        while ( valueStart < innerEnd && /\s/.test( content[ valueStart ] ) ) {
          valueStart++;
        }

        const valueEnd = findValueEnd(
          content,
          valueStart
        );

        return {
          valueStart,
          valueEnd
        };
      }
    }

    i++;
  }

  return null;
}

/** Serialize a leaf value (scalar or array) as a compact inline literal. */
function serializeLeaf( value: unknown ): string {
  if ( value === null ) return "null";
  if ( typeof value === "boolean" || typeof value === "number" ) return String( value );
  if ( typeof value === "string" ) return JSON.stringify( value );

  if ( Array.isArray( value ) ) {
    return `[ ${ value.map( serializeLeaf ).join( ", " ) } ]`;
  }

  return JSON.stringify( value );
}

// ---------------------------------------------------------------------------
// Main rewrite: apply targeted leaf replacements only
// ---------------------------------------------------------------------------

function applyChanges(
  content: string, changes: PathChange[]
): string {
  const marker = "export const formValues =";
  const markerPos = content.indexOf( marker );

  if ( markerPos === -1 ) {
    throw new Error( "Could not find 'export const formValues' in options.ts" );
  }

  const openBracePos = content.indexOf(
    "{",
    markerPos + marker.length
  );

  if ( openBracePos === -1 ) {
    throw new Error( "Could not find opening brace for formValues" );
  }

  type Replacement = {
 start: number; end: number; text: string
};
  const replacements: Replacement[] = [
  ];

  for ( const change of changes ) {
    const {
      path, newValue
    } = change;

    let currentObjOpen = openBracePos;
    let found = true;
    let valueStart = -1;
    let valueEnd = -1;

    for ( let pi = 0; pi < path.length; pi++ ) {
      const key = path[ pi ];
      const isLast = pi === path.length - 1;
      const objClose = findObjectClose(
        content,
        currentObjOpen
      );

      if ( objClose === -1 ) { found = false; break; }

      const inner = findKeyAtDepth0(
        content,
        currentObjOpen + 1,
        objClose,
        key
      );

      if ( !inner ) { found = false; break; }

      if ( isLast ) {
        valueStart = inner.valueStart;
        valueEnd = inner.valueEnd;
      } else {
        // Must be an object to navigate further
        if ( content[ inner.valueStart ] !== "{" ) { found = false; break; }

        currentObjOpen = inner.valueStart;
      }
    }

    if ( found && valueStart !== -1 ) {
      replacements.push( {
        start: valueStart,
        end: valueEnd,
        text: serializeLeaf( newValue )
      } );
    }
  }

  if ( replacements.length === 0 ) return content;

  // Apply in reverse position order so earlier offsets stay valid
  replacements.sort( (
    a, b
  ) => b.start - a.start );

  let result = content;

  for ( const rep of replacements ) {
    result = result.slice(
      0,
      rep.start
    ) + rep.text + result.slice( rep.end );
  }

  return result;
}

export async function POST( request: Request ) {
  if ( process.env.NODE_ENV === "production" ) {
    return new Response(
      "Not found",
      {
        status: 404,
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new Response(
      "Invalid JSON body",
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof ( body as Record<string, unknown> ).sketch !== "string" ||
    typeof ( body as Record<string, unknown> ).engineId !== "string" ||
    typeof ( body as Record<string, unknown> ).formValues !== "object" ||
    ( body as Record<string, unknown> ).formValues === null ||
    typeof ( body as Record<string, unknown> ).originalFormValues !== "object" ||
    ( body as Record<string, unknown> ).originalFormValues === null
  ) {
    return new Response(
      "Missing required fields: sketch (string), engineId (string), formValues (object), originalFormValues (object)",
      {
        status: 400,
      }
    );
  }

  const {
    sketch,
    engineId,
    formValues,
    originalFormValues,
  } = body as {
    sketch: string;
    engineId: string;
    formValues: Record<string, unknown>;
    originalFormValues: Record<string, unknown>;
  };

  const optionsPath = getOptionsFilePath(
    sketch,
    engineId
  );

  if ( !optionsPath ) {
    return new Response(
      `Sketch "${ sketch }" not found in metadata`,
      {
        status: 404,
      }
    );
  }

  if ( !fs.existsSync( optionsPath ) ) {
    return new Response(
      "options.ts not found for this sketch",
      {
        status: 404,
      }
    );
  }

  const changes = deepDiff(
    originalFormValues,
    formValues
  );

  if ( changes.length === 0 ) {
    return new Response(
      JSON.stringify( {
        ok: true,
        changed: 0
      } ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        },
      }
    );
  }

  const content = fs.readFileSync(
    optionsPath,
    "utf-8"
  );
  let updated: string;

  try {
    updated = applyChanges(
      content,
      changes
    );
  } catch ( err ) {
    return new Response(
      String( err ),
      {
        status: 422,
      }
    );
  }

  fs.writeFileSync(
    optionsPath,
    updated,
    "utf-8"
  );

  return new Response(
    JSON.stringify( {
      ok: true,
      changed: changes.length
    } ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      },
    }
  );
}

