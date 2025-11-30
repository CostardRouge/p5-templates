// Main component
export {
  default as FormUndoRedo
} from "./FormUndoRedo";
export type {
  FormUndoRedoProps
} from "./FormUndoRedo";

// Hooks
export {
  default as useFormUndoRedo
} from "./hooks/useFormUndoRedo";
export {
  default as useFormUndoRedoHistory
} from "./hooks/useFormUndoRedoHistory";
export {
  default as useFormUndoRedoMetrics
} from "./hooks/useFormUndoRedoMetrics";
export {
  default as useFormUndoRedoBatch
} from "./hooks/useFormUndoRedoBatch";

// Components
export {
  default as HistoryVisualizer
} from "./components/HistoryVisualizer";

// Types
export type {
  HistoryEntry,
  FormUndoRedoStacks,
  FormUndoRedoAutoCaptureMode,
  PerformanceMetrics,
  FormUndoRedoContextType,
  FormUndoRedoConfig,
} from "./types/FormUndoRedo.types";

// Utils
export {
  createStateHash,
  safeDeepClone,
  shouldTrackPath,
  estimateHistorySize,
} from "./utils/historyUtils";
