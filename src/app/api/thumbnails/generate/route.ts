import createSketchThumbnails from "@/lib/createSketchThumbnails";

export async function GET( ) {
  if ( process.env.NODE_ENV === "production" && process.env.ENABLE_VIDEO_GENERATION === "false" ) {
    return;
  }

  await createSketchThumbnails();

  return Response.json( {
    status: 200
  } );
}