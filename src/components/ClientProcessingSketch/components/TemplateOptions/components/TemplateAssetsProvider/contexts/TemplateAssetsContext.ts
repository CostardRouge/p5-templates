import {
  createContext
} from "react";
import {
  TemplateAssetsContextType
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/types/TemplateAssetsProviderTypes";

const TemplateAssetsContext = createContext<TemplateAssetsContextType | null>( null );

export default TemplateAssetsContext;