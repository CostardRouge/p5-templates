import type {
  JobId
} from "@/types/recording.types";

type Scope = "global" | {
  slide: number
};

export type TemplateAssetsContextType = {
  assetsName: string;
  jobId?: JobId;
  scope: Scope;
}