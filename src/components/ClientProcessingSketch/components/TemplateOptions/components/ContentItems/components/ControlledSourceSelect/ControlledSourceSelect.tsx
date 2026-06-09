import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  BUILTIN_SOURCES, flattenKeys
} from "@/p5/utils/hud/keyPaths";

type ControlledSourceSelectProps = {
  name: string;
  className?: string;
};

/**
 * Source picker for HUD widgets. Populated — like the `specs` overlay — by
 * enumerating the keys that already exist in the sketch settings, plus the
 * built-in live sources. No probe registry / runtime bridge required: the form
 * already holds the sketch settings, so the key list is derived client-side.
 */
export default function ControlledSourceSelect( {
  name,
  className = "w-full p-1 border border-theme rounded-lg bg-background text-foreground"
}: ControlledSourceSelectProps ) {
  const {
    register, control
  } = useFormContext();

  const sketch = useWatch( {
    control,
    name: "sketch"
  } );

  const keys = flattenKeys( sketch ?? {} );

  return (
    <select
      id={ name }
      className={ className }
      { ...register( name ) }
    >
      <optgroup label="Live / built-in">
        {BUILTIN_SOURCES.map( ( source ) => (
          <option key={ source.value } value={ source.value }>
            {source.label}
          </option>
        ) )}
      </optgroup>

      {keys.length > 0 && (
        <optgroup label="Sketch parameters">
          {keys.map( ( key ) => (
            <option key={ key } value={ key }>
              {key}
            </option>
          ) )}
        </optgroup>
      )}
    </select>
  );
}
