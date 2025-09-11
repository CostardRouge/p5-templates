import {
  useContext
} from "react";

import ArrayContentContext from "../contexts/ArrayContentContext";

export default function useContentArray() {
  const context = useContext( ArrayContentContext );

  if ( !context ) {
    throw new Error( "useContentArray must be used inside <ContentArrayProvider>" );
  }

  return context;
}
