import createSketchPreviews from "@/lib/createSketchPreviews";
import {
  NextResponse
} from "next/server";

export async function GET() {
  if ( process.env.NODE_ENV === "production" ) {
    return new NextResponse(
      "Not found",
      {
        status: 404
      }
    );
  }

  await createSketchPreviews();

  return Response.json( {
    status: 200
  } );
}
