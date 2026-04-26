import {
  useContext
} from "react";

import SketchContext from "../contexts/SketchContext";
import type {
  SketchState, SketchAction
} from "../types/SketchContextType";

export default function useSketch(): [SketchState, React.Dispatch<SketchAction>] {
  const context = useContext( SketchContext );

  if ( !context ) {
    throw new Error( "useSketch must be used inside <SketchContextProvider>" );
  }

  return context;
}
