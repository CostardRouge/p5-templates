import createSketchThumbnails from "@/lib/createSketchThumbnails";

export async function GET( ) {
  await createSketchThumbnails();

  return Response.json( {
    status: 200
  } );
}