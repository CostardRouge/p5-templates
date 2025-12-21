import {
  createContext
} from "react";

import type {
  SketchContextType
} from "../types/SketchContextType";

const SketchContext = createContext<SketchContextType | null>( null );

export default SketchContext;
