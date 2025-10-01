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
    <div className="text-xs text-gray-500 flex gap-1">
      <button
        onClick={undo}
        // disabled={!canUndo}
        className="rounded-sm bg-white border border-gray-400 p-1 hover:text-black"
      >
        <Undo className="h-4" />
      </button>

      <button
        onClick={redo}
        // disabled={!canRedo}
        className="rounded-sm bg-white border border-gray-400 p-1 hover:text-black"
      >
        <Redo className="h-4" />
      </button>
    </div>
  );
}