import {
  Redo, Undo
} from "lucide-react";

import useFormUndoRedo from "@/components/ClientProcessingSketch/components/SketchOptions/components/FormUndoRedo/hooks/useFormUndoRedo";

/**
 * Undo/redo buttons for the sketch options form. Must render inside
 * <FormUndoRedo /> (which itself lives inside the form's FormProvider).
 * Clicks stop propagation so the buttons can sit in collapsible headers
 * without toggling them.
 */
export default function UndoRedo() {
  const {
    redo, undo, canUndo, canRedo
  } = useFormUndoRedo();

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={ ( e ) => {
          e.stopPropagation();
          undo();
        } }
        disabled={ !canUndo }
        className="text-xs flex items-center text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        title={ canUndo ? "Undo (Cmd/Ctrl+Z)" : "No history to undo" }
        aria-label="Undo"
      >
        <Undo className="h-3.5" />
      </button>

      <button
        type="button"
        onClick={ ( e ) => {
          e.stopPropagation();
          redo();
        } }
        disabled={ !canRedo }
        className="text-xs flex items-center text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        title={ canRedo ? "Redo (Cmd/Ctrl+Shift+Z)" : "No history to redo" }
        aria-label="Redo"
      >
        <Redo className="h-3.5" />
      </button>
    </div>
  );
}
