import {
  Redo, Undo
} from "lucide-react";

import useFormUndoRedo
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/FormUndoRedo/hooks/useFormUndoRedo";

export default function UndoRedo( {
} ) {
  const {
    redo, undo, canUndo, canRedo
  } = useFormUndoRedo();

  return (
    <div className="flex gap-1">
      <button
        onClick={undo}
        // disabled={!canUndo}
        className="p-0.5 rounded bg-background border border-theme text-foreground"
      >
        <Undo className="h-3.5" />
      </button>

      <button
        onClick={redo}
        // disabled={!canRedo}
        className="p-0.5 rounded bg-background border border-theme text-foreground"
      >
        <Redo className="h-3.5" />
      </button>
    </div>
  );
}