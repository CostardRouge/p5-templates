import {
  createContext
} from "react";
import {
  SketchAssetsContextType
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/types/SketchAssetsProviderTypes";

const SketchAssetsContext = createContext<SketchAssetsContextType | null>( null );

export default SketchAssetsContext;
