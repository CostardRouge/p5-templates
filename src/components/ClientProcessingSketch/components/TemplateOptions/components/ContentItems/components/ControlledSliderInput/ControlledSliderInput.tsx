"use client";

import React from "react";
import {
  useController
} from "react-hook-form";
import SliderInput from "./SliderInput";

type ControlledSliderInputProps = {
  name: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * React-hook-form binding around the presentational {@link SliderInput}: reads
 * and writes the field at `name`, delegating all rendering and drag behaviour to
 * the shared slider so form fields and non-form controls look identical.
 */
export default function ControlledSliderInput( {
  name,
  label,
  min = 0,
  max = 100,
  step = 1,
  isModified = false,
  onReset
}: ControlledSliderInputProps ) {
  const {
    field
  } = useController( {
    name
  } );

  return (
    <SliderInput
      value={ Number( field.value ) }
      onChange={ field.onChange }
      onBlur={ field.onBlur }
      label={ label ?? name }
      min={ min }
      max={ max }
      step={ step }
      isModified={ isModified }
      onReset={ onReset }
    />
  );
}
