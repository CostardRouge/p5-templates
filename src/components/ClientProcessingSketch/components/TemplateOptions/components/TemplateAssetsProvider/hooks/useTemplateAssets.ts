import {
  useContext
} from "react";

import TemplateAssetsContext from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/contexts/TemplateAssetsContext";

export default function useTemplateAssets() {
  const context = useContext( TemplateAssetsContext );

  if ( !context ) {
    return {
      scope: "global" as const,
      assetsName: "assets",
      jobId: undefined
    };
  }

  return context;
}
