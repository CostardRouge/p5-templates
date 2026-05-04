import listDirectory from "@/utils/listDirectory";

const acceptedImageTypes = [
  "png",
  "jpg",
  "arw",
  "jpeg",
  "webp"
];

const fallbackTestImageFileNames = [
  "DSC02023 Medium.jpeg",
  "DSC02644 Medium.jpeg",
  "DSC02930 Medium.jpeg",
  "DSC02978 Medium.jpeg",
  "DSC02995 Medium.jpeg",
  "DSC03056 Medium.jpeg",
  "DSC03139 Medium.jpeg",
  "DSC03515 Medium.jpeg"
];

function isAcceptedImageType( fileName: string ) {
  const extension = fileName
    .split( "." )
    .pop()
    ?.toLowerCase();

  return extension ? acceptedImageTypes.includes( extension ) : false;
}

export default async function getTestImagePaths() {
  const testImageFileNames = await listDirectory( "public/assets/images/test" );
  const fileNames = testImageFileNames.length
    ? testImageFileNames
    : fallbackTestImageFileNames;

  return (
    fileNames
      .filter( isAcceptedImageType )
      .map( ( f ) => `/assets/images/test/${ encodeURIComponent( f ) }` )
  );
}