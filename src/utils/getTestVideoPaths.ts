import listDirectory from "@/utils/listDirectory";

const acceptedVideoTypes = [
  "mp4",
  "webm",
  "mov",
  "m4v"
];

const fallbackTestVideoFileNames = [
  "gradient-flow.mp4",
  "photos-zoom.mp4",
  "shapes-orbit.mp4"
];

function isAcceptedVideoType( fileName: string ) {
  const extension = fileName
    .split( "." )
    .pop()
    ?.toLowerCase();

  return extension ? acceptedVideoTypes.includes( extension ) : false;
}

/**
 * Default example videos for the video templates — the video counterpart of
 * `getTestImagePaths`. The clips live in `public/assets/videos/test` and are
 * produced by `scripts/generate-test-videos.mjs`.
 *
 * Server-only: reads the public folder via `fs/promises`.
 */
export default async function getTestVideoPaths() {
  const testVideoFileNames = await listDirectory( "public/assets/videos/test" );
  const fileNames = testVideoFileNames.length
    ? testVideoFileNames
    : fallbackTestVideoFileNames;

  return (
    fileNames
      .filter( isAcceptedVideoType )
      .map( ( f ) => `/assets/videos/test/${ encodeURIComponent( f ) }` )
  );
}

/**
 * Resolve a single test video whose file name contains `name`, falling back
 * to the first available test video. Lets template defaults pick the clip
 * that suits them (e.g. the high-contrast one for halftone) without
 * hardcoding the full path.
 */
export async function getTestVideoPath( name: string ) {
  const paths = await getTestVideoPaths();

  return paths.find( ( p ) => p.includes( name ) ) ?? paths[ 0 ];
}
