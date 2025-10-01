export type FormUndoRedoStacks = {
  past: any[];
  future: any[]
};

export type FormUndoRedoAutoCaptureMode = "off" | "debounced"; // keep it simple for now

export type FormUndoRedoContextType = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Optional controls if you ever need them
  pause: () => void;
  resume: () => void;
  runSilently: ( fn: () => void ) => void;
};