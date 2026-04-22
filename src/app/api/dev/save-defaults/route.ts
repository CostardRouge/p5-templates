import fs from "node:fs";
import path from "node:path";
import metadata from "@/p5-sketches/sketches/metadata.json";

type SketchMetadata = {
  name: string;
  category: string | null;
};

function getOptionsFilePath( sketchName: string ): string | null {
  const meta = ( metadata as SketchMetadata[] ).find( ( m ) => m.name === sketchName );

  if ( !meta ) return null;

  const sketchPath = meta.category
    ? `${ meta.category }/${ sketchName }`
    : sketchName;

  return path.join(
    process.cwd(),
    "src",
    "p5-sketches",
    "sketches",
    sketchPath,
    "options.ts"
  );
}

const IDENT = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function serializeValue( value: unknown, depth: number ): string {
  const pad = "  ".repeat( depth );
  const innerPad = "  ".repeat( depth + 1 );

  if ( value === null ) return "null";
  if ( typeof value === "boolean" || typeof value === "number" ) return String( value );
  if ( typeof value === "string" ) return JSON.stringify( value );

  if ( Array.isArray( value ) ) {
    if ( value.length === 0 ) return "[]";

    const items = value.map( ( v ) => `${ innerPad }${ serializeValue( v, depth + 1 ) }` );

    return `[\n${ items.join( ",\n" ) },\n${ pad }]`;
  }

  if ( typeof value === "object" ) {
    const entries = Object.entries( value as Record<string, unknown> );

    if ( entries.length === 0 ) return "{}";

    const lines = entries.map( ( [ k, v ] ) => {
      const key = IDENT.test( k ) ? k : JSON.stringify( k );

      return `${ innerPad }${ key }: ${ serializeValue( v, depth + 1 ) },`;
    } );

    return `{\n${ lines.join( "\n" ) }\n${ pad }}`;
  }

  return String( value );
}

function replaceFormValuesBlock(
  content: string,
  formValues: Record<string, unknown>
): string {
  const marker = "export const formValues =";
  const markerPos = content.indexOf( marker );

  if ( markerPos === -1 ) {
    throw new Error( "Could not find 'export const formValues' in options.ts" );
  }

  // Find the opening brace after the marker
  const braceOpenPos = content.indexOf(
    "{",
    markerPos + marker.length
  );

  if ( braceOpenPos === -1 ) {
    throw new Error( "Could not find opening brace for formValues" );
  }

  // Walk brace depth to find the matching closing brace.
  // This is safe for options.ts files which only contain simple data literals
  // (no template literals or regex that could contain braces).
  let braceDepth = 0;
  let braceClosePos = -1;

  for ( let i = braceOpenPos; i < content.length; i++ ) {
    if ( content[ i ] === "{" ) braceDepth++;
    else if ( content[ i ] === "}" ) {
      braceDepth--;

      if ( braceDepth === 0 ) {
        braceClosePos = i;
        break;
      }
    }
  }

  if ( braceClosePos === -1 ) {
    throw new Error( "Could not find closing brace for formValues" );
  }

  // Consume any trailing whitespace then the semicolon
  let blockEnd = braceClosePos + 1;

  while (
    blockEnd < content.length &&
    ( content[ blockEnd ] === " " || content[ blockEnd ] === "\t" )
  ) {
    blockEnd++;
  }

  if ( blockEnd < content.length && content[ blockEnd ] === ";" ) {
    blockEnd++;
  }

  const newBlock = `export const formValues = ${ serializeValue( formValues, 0 ) };`;

  return content.slice( 0, markerPos ) + newBlock + content.slice( blockEnd );
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
    typeof ( body as Record<string, unknown> ).formValues !== "object" ||
    ( body as Record<string, unknown> ).formValues === null
  ) {
    return new Response(
      "Missing required fields: sketch (string), formValues (object)",
      {
        status: 400,
      }
    );
  }

  const {
    sketch,
    formValues,
  } = body as {
    sketch: string;
    formValues: Record<string, unknown>;
  };

  const optionsPath = getOptionsFilePath( sketch );

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

  const content = fs.readFileSync(
    optionsPath,
    "utf-8"
  );

  let updated: string;

  try {
    updated = replaceFormValuesBlock(
      content,
      formValues
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
    } ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
