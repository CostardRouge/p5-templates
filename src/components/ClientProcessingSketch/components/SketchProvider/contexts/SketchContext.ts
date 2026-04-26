import {
  createContext
} from "react";

import type {
  SketchState, SketchAction
} from "../types/SketchContextType";

const SketchContext = createContext<[SketchState, React.Dispatch<SketchAction>] | null>( null );

export default SketchContext;
