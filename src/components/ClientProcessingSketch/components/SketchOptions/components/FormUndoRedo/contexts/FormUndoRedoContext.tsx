import React from "react";

import type {
  FormUndoRedoContextType
} from "../types/FormUndoRedo.types";

const FormUndoRedoContext = React.createContext<FormUndoRedoContextType | null>( null );

export default FormUndoRedoContext;
