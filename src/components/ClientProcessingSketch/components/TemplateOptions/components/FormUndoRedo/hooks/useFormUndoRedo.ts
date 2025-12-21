import React from "react";

import FormUndoRedoContext from "../contexts/FormUndoRedoContext";

export default function useFormUndoRedo() {
  const context = React.useContext( FormUndoRedoContext );

  if ( !context ) {
    throw new Error( "useFormUndoRedo must be used within <FormUndoRedo />" );
  }

  return context;
}
