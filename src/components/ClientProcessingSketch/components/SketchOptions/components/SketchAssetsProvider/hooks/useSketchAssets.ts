import {
  useContext
} from "react";

import SketchAssetsContext from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/contexts/SketchAssetsContext";

export default function useSketchAssets() {
  const context = useContext( SketchAssetsContext );

  if ( !context ) {
    return {
      scope: "global" as const,
      assetsName: "assets",
      jobId: undefined
    };
  }

  return context;
}
