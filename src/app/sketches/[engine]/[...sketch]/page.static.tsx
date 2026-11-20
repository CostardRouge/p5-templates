import {
  getMetadata
} from "@/engines/metadata";
import {
  renderStudio,
  type RouteParams
} from "./studio";

/* The studio on the static front (next.config.ts, "Two builds"): one page per
   sketch, prerendered at build under its canonical path, with no query string,
   no job and no backend — the browser does the rest, as it already did. */

export {
  generateMetadata
} from "./studio";

export const dynamicParams = false;

export function generateStaticParams(): RouteParams[] {
  return getMetadata().map( ( sketch ) => ( {
    engine: sketch.engine,
    sketch: sketch.category
      ? [
        sketch.category,
        sketch.name
      ]
      : [
        sketch.name
      ]
  } ) );
}

export default function StudioPage( {
  params
}: {
  params: Promise<RouteParams>;
} ) {
  return renderStudio( {
    params
  } );
}
