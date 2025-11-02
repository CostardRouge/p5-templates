import {
  useContext
} from "react";

import SketchContext from "../contexts/SketchContext";

export default function useSketch() {
  const context = useContext( SketchContext );

  if ( !context ) {
    throw new Error( "useContentArray must be used inside <SketchContextProvider>" );
  }

  return context;
}
