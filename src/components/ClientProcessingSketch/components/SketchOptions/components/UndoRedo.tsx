import {
  Redo, Undo
} from "lucide-react";

import useFormUndoRedo from "@/components/ClientProcessingSketch/components/SketchOptions/components/FormUndoRedo/hooks/useFormUndoRedo";

export default function UndoRedo() {
  const {
    redo, undo, canUndo, canRedo
  } = useFormUndoRedo();

  return (
    <div className="flex gap-1">
      <button
        onClick={ undo }
        disabled={ !canUndo }
        className="p-0.5 rounded-xl bg-background border border-theme text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        title={ canUndo ? "Undo (Cmd/Ctrl+Z)" : "No history to undo" }
      >
        <Undo className="h-3" />
      </button>

      <button
        onClick={ redo }
        disabled={ !canRedo }
        className="p-0.5 rounded-xl bg-background border border-theme text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        title={ canRedo ? "Redo (Cmd/Ctrl+Shift+Z)" : "No history to redo" }
      >
        <Redo className="h-3" />
      </button>
    </div>
  );
}
