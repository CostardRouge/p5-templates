"use client";

import {
  useController, useFormContext
} from "react-hook-form";

import Vector2DPad, {
  type Vector2DInputConfig, type Vector2DValue
} from "./Vector2DPad";

export type {
  Vector2DInputConfig, Vector2DValue
} from "./Vector2DPad";

type Props = {
  name: string;
  config?: Vector2DInputConfig;
};

/**
 * Binds the presentational {@link Vector2DPad} to react-hook-form. Reads/writes
 * `{ x, y }` on the field while preserving any sibling keys stored alongside
 * them, so the pad can edit a position nested inside a larger value object.
 */
export default function ControlledVector2DInput( {
  name, config
}: Props ) {
  const {
    control
  } = useFormContext();

  const {
    field
  } = useController( {
    name,
    control
  } );

  const raw = field.value as Partial<Vector2DValue> | undefined;

  return (
    <Vector2DPad
      value={ raw }
      onChange={ ( next ) =>
        field.onChange( {
          ...( raw && typeof raw === "object" ? raw : {} ),
          x: next.x,
          y: next.y
        } )
      }
      config={ config }
      ariaLabel={ name }
    />
  );
}
