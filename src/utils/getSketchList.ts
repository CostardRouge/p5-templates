// Import metadata.json directly as a module so it's bundled in production
import metadata from "@/p5-sketches/sketches/metadata.json";

type SketchMeta = {
  name: string;
  category: string | null;
  mtime: string;
  ctime: string;
  hasSketchForm: boolean;
  hasThumbnail?: boolean;
};

async function getSketchList() {
  try {
    const meta = metadata as SketchMeta[];

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
