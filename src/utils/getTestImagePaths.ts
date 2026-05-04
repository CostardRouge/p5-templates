import listDirectory from "@/utils/listDirectory";

const acceptedImageTypes = [
  "png",
  "jpg",
  "arw",
  "jpeg",
  "webp"
];

export default async function getTestImagePaths() {
  const testImageFileNames = await listDirectory( "public/assets/images/test" );

  return (
    testImageFileNames
      .filter( ( f ) => acceptedImageTypes.includes( f.split( "." )[ 1 ] ) )
      .map( ( f ) => `/assets/images/test/${ f }` )
  );
}