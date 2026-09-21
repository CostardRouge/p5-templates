"use client";

import {
  useController, useFormContext
} from "react-hook-form";

import Vector3DPad, {
  type Vector3DInputConfig, type Vector3DValue
} from "./Vector3DPad";

export type {
  Vector3DInputConfig, Vector3DValue
} from "./Vector3DPad";

type Props = {
  name: string;
  config?: Vector3DInputConfig;
};

/**
 * Binds the presentational {@link Vector3DPad} to react-hook-form. Reads and
 * writes `{ x, y, z }` on the field while preserving any sibling keys stored
 * alongside them — the same merge the 2D pad does, so the triple can live
 * inside a larger value object.
 */
export default function ControlledVector3DInput( {
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

  const raw = field.value as Partial<Vector3DValue> | undefined;

  return (
    <Vector3DPad
      value={ raw }
      onChange={ ( next ) =>
        field.onChange( {
          ...( raw && typeof raw === "object" ? raw : {} ),
          x: next.x,
          y: next.y,
          z: next.z
        } )
      }
      config={ config }
      ariaLabel={ name }
    />
  );
}
