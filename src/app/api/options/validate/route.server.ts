import {
  NextResponse
} from "next/server";

import {
  validateOptionsDocument
} from "@/lib/optionsDocument";

/**
 * Check an options document against `OptionsSchema` and answer the issues by
 * path, or the document with its defaults filled in. Pure: nothing is stored, fetched or run — the body is parsed and
 * dropped — and it is capped so a caller cannot hand the server an unbounded
 * parse (there is no auth, see docs/memory/security.md).
 */
const MAX_BODY_CHARS = 2_000_000;

function answer(
  body: Record<string, unknown>, status = 200
) {
  return NextResponse.json(
    body,
    {
      status
    }
  );
}

export async function POST( request: Request ) {
  const raw = await request.text();

  if ( raw.length > MAX_BODY_CHARS ) {
    return answer(
      {
        error: `Body over ${ MAX_BODY_CHARS } characters`
      },
      413
    );
  }

  let options: unknown;

  try {
    options = JSON.parse( raw );
  } catch {
    return answer(
      {
        error: "Body must be the options document as JSON"
      },
      400
    );
  }

  const {
    issues, normalized
  } = validateOptionsDocument( options );

  // `normalized` is the document with every default filled in: what a caller
  // building one by hand should store (see `OptionsVerdict`).
  return answer( {
    valid: issues.length === 0,
    issues,
    ...( normalized ? {
      normalized
    } : {} )
  } );
}
