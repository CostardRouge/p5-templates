import React from "react";
import {
  useFormContext, Controller
} from "react-hook-form";

import rgbaToHex from "./utils/rgbaToHex";
import hexToRgba from "./utils/hexToRgba";

type ControlledColorInputProps = {
  name: string; // The name of the field, e.g., "content.0.fill"
};

export default function ControlledColorInput( {
  name
}: ControlledColorInputProps ) {
  const {
    control
  } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={( {
        field
      } ) => (
        <input
          type="color"
          className="w-full rounded-sm border border-gray-300 p-0.5 cursor-pointer"
          // When the input changes, it gives a hex string.
          // We convert it to RGBA before calling field.onChange to update the form state.
          onChange={( e ) => field.onChange( hexToRgba( e.target.value ) )}
          // The field's value is an RGBA array.
          // We convert it back to hex for the input's value attribute.
          value={rgbaToHex( field.value )}
        />
      )}
    />
  );
}
