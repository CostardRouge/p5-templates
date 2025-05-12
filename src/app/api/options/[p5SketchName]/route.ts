import listDirectory from "@/utils/listDirectory";
import getSketchOptions from "@/utils/getSketchOptions";

const acceptedImageTypes = [
  "png",
  "jpg",
  "arw",
  "jpeg",
  "webp"
];
const testImageFileNames = await listDirectory( "public/assets/images/test" );

const defaultSketchOptions = {
  size: {
    width: 1080,
    height: 1350
  },
  animation: {
    duration: 12,
    framerate: 60
  }
};

export async function GET(
  _: Request,
  {
    params
  }: {
 params: Promise<{
 p5SketchName: string
}>
}
) {
  const p5SketchName = ( await params ).p5SketchName;
  const sketchOptions = Object.assign(
    defaultSketchOptions,
    getSketchOptions( p5SketchName )
  );

  if ( !sketchOptions?.assets ) {
    sketchOptions.assets = testImageFileNames
      .filter( testImageFileName => acceptedImageTypes.includes( testImageFileName.split( "." )[ 1 ] ) )
      .map( testImageFileName => `/assets/images/test/${ testImageFileName }` );
  }

  return Response.json(
    sketchOptions,
    {
      status: 200
    }
  );
}