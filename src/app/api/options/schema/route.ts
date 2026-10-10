import {
  NextResponse
} from "next/server";

import {
  optionsJsonSchema
} from "@/lib/optionsDocument";

/**
 * The options document's JSON Schema (`OptionsSchema`, input side): what a
 * script or an agent may put in a piece — size, clock, content items, slides,
 * assets. Pure description of the app's own types, no data and nothing
 * stored, so it is as public as the code it is generated from.
 */
export function GET() {
  return NextResponse.json(
    optionsJsonSchema(),
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
      }
    }
  );
}
