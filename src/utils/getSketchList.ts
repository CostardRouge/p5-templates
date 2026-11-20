// Import metadata from the unified sketches registry
import {
  getMetadata
} from "@/engines/metadata";

async function getSketchList() {
  try {
    const meta = getMetadata();

    return meta.map( ( {
      name,
      engine,
      category,
      hasSketchForm,
      hasPreview,
      hiddenFromHome,
      hiddenFromGallery,
      favorite,
      mtime
    } ) => ( {
      name,
      engine,
      category,
      hasSketchForm,
      hasPreview: hasPreview ?? false,
      hiddenFromHome: hiddenFromHome ?? false,
      hiddenFromGallery: hiddenFromGallery ?? false,
      favorite: favorite ?? false,
      mtime
    } ) );
  } catch( err ) {
    console.error(
      "Failed to read sketch metadata:",
      err
    );
    return [];
  }
}

export default getSketchList;
