// import createSketchThumbnails from "@/lib/createSketchThumbnails";

export async function GET( ) {
  if ( process.env.NODE_ENV === "production" && process.env.ENABLE_VIDEO_GENERATION === "false" ) {
    return;
  }

  const createSketchThumbnails = await import( "@/lib/createSketchThumbnails" );

  // @ts-ignore
  await createSketchThumbnails();

  return Response.json( {
    status: 200
  } );
}