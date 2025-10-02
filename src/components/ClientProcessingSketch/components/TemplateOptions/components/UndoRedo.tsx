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
        className="p-0.5 rounded-sm bg-white border border-gray-300 hover:border-gray-400 hover:text-black text-gray-500"
      >
        <Undo className="h-3.5" />
      </button>

      <button
        onClick={redo}
        // disabled={!canRedo}
        className="p-0.5 rounded-sm bg-white border border-gray-300 hover:border-gray-400 hover:text-black text-gray-500"
      >
        <Redo className="h-3.5" />
      </button>
    </div>
  );
}