// Import metadata from the unified sketches registry
import {
  getMetadata
} from "@/engines/metadata";

async function getSketchList() {
  try {
    const meta = getMetadata();

    return meta.map( ( {
      name, category, hasSketchForm
    } ) => ( {
      name,
      category,
      hasSketchForm,
    } ) );
  } catch ( err ) {
    console.error(
      "Failed to read sketch metadata:",
      err
    );
    return [
    ];
  }
}

export default getSketchList;
