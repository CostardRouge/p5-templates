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
      hiddenFromTemplates
    } ) => ( {
      name,
      engine,
      category,
      hasSketchForm,
      hasPreview: hasPreview ?? false,
      hiddenFromHome: hiddenFromHome ?? false,
      hiddenFromTemplates: hiddenFromTemplates ?? false
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
