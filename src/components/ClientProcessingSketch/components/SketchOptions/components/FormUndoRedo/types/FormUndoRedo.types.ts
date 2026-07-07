import type {
  Patch
} from "immer";

// History entry with metadata
export type HistoryEntry<T = any> = {
  state: T; // Full state snapshot
  patches?: Patch[]; // Immer patches (for efficient storage)
  inversePatches?: Patch[]; // For undo
  timestamp: number;
  description?: string; // Optional description of the change
  affectedPaths?: string[]; // Which form paths were modified
  batchId?: string; // For grouping related changes
};

// Stack structure with metadata
export type FormUndoRedoStacks<T = any> = {
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
};

// Auto-capture modes
export type FormUndoRedoAutoCaptureMode = "off" | "debounced" | "immediate";

// Performance metrics
export type PerformanceMetrics = {
  historySize: number; // Total entries
  memoryEstimate: number; // Rough bytes estimate
  lastOperationTime: number; // ms
  totalOperations: number;
};

// Context type with enhanced API
export type FormUndoRedoContextType<T = any> = {
  // Core operations
  undo: () => void;
  redo: () => void;
  clear: () => void;

  // State queries
  canUndo: boolean;
  canRedo: boolean;

  // History access
  getHistory: () => {
    past: HistoryEntry<T>[];
    future: HistoryEntry<T>[];
  };

  // Jump to specific point
  jumpTo: ( index: number, direction: "past" | "future" ) => void;

  // Manual capture
  capture: ( description?: string ) => void;

  // Batch operations
  startBatch: ( description?: string ) => string; // Returns batchId
  endBatch: () => void;

  // Control
  pause: () => void;
  resume: () => void;
  runSilently: ( fn: () => void ) => void;

  // Debugging
  getMetrics: () => PerformanceMetrics;
  enableDebug: ( enabled: boolean ) => void;
};

// Configuration options
export type FormUndoRedoConfig = {
  maxHistory?: number;
  hotkeys?: boolean;
  captureInitial?: boolean;
  autoCapture?: FormUndoRedoAutoCaptureMode;
  debounceMs?: number;
  watchPaths?: string[];
  usePatches?: boolean; // Use Immer patches for efficiency
  enablePersistence?: boolean; // Save to localStorage
  persistenceKey?: string;
  debug?: boolean;
};
