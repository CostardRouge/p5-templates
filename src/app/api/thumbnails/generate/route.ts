import createSketchThumbnails from "@/lib/createSketchThumbnails";
import {
  NextResponse
} from "next/server";

export async function GET() {
  if ( process.env.NODE_ENV === "production" ) {
    return new NextResponse(
      "Not found",
      {
        status: 404,
      }
    );
  }

  await createSketchThumbnails();

  return Response.json( {
    status: 200,
  } );
}
