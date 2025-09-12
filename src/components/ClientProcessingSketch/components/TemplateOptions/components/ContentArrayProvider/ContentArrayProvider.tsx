"use client";

import React from "react";

import ArrayContentContext from "./contexts/ArrayContentContext";

import {
  useFieldArray, useFormContext
} from "react-hook-form";

type ContentArrayProviderProps = {
  name: string;
}

export default function ContentArrayProvider( {
  children,
  name
}: React.PropsWithChildren<ContentArrayProviderProps> ) {
  const {
    control
  } = useFormContext();
  const fieldArray = useFieldArray( {
    control,
    name
  } );

  return (
    <ArrayContentContext.Provider
      key={name}
      value={{
        name,
        fields: fieldArray.fields,
        append: fieldArray.append,
        remove: fieldArray.remove,
        move: fieldArray.move
      }}
    >
      { children }
    </ArrayContentContext.Provider>
  );
}
