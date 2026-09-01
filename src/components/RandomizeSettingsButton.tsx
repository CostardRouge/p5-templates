"use client";

import React from "react";
import {
  Shuffle
} from "lucide-react";
import {
  useFormContext
} from "react-hook-form";
import {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  randomVector2D
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/ControlledVector2DInput/utils/vector2dMath";

type RandomizeSettingsButtonProps = {
  config: Record<string, FieldConfig>;
  basePath: string;
  className?: string;
};

export default function RandomizeSettingsButton( {
  config,
  basePath,
  className = "text-foreground hover:bg-theme/20 rounded transition-colors"
}: RandomizeSettingsButtonProps ) {
  const {
    getValues, setValue
  } = useFormContext();

  const randomizeConfig = (
    config: Record<string, FieldConfig>,
    path: string
  ) => {
    for ( const [
      key,
      field
    ] of Object.entries( config ) ) {
      const fullPath = path ? `${ path }.${ key }` : key;

      switch ( field.component ) {
        case "number":
        case "slider":
          if ( field.min !== undefined && field.max !== undefined ) {
            const randomValue =
              Math.random() * ( field.max - field.min ) + field.min;

            setValue(
              fullPath,
              field.step
                ? Math.round( randomValue / field.step ) * field.step
                : randomValue
            );
          }
          break;
        case "checkbox":
          setValue(
            fullPath,
            Math.random() > 0.5
          );
          break;
        // A vector2d is one field holding a pair, so it is randomized as a
        // pair: a uniform point inside the pad's own bounds, snapped to its
        // step. Sibling keys are preserved for the same reason the pad
        // preserves them — the { x, y } can live inside a larger value object.
        case "vector2d": {
          const current = getValues( fullPath );

          setValue(
            fullPath,
            {
              ...( current && typeof current === "object" ? current : {} ),
              ...randomVector2D( field )
            }
          );
          break;
        }
        case "color":
          // setValue(
          //   fullPath,
          //   [
          //     Math.floor( Math.random() * 255 ),
          //     Math.floor( Math.random() * 255 ),
          //     Math.floor( Math.random() * 255 ),
          //   ]
          // );
          break;
        case "select":
          if ( field.options && field.options.length > 0 ) {
            const randomOption =
              field.options[ Math.floor( Math.random() * field.options.length ) ];

            setValue(
              fullPath,
              randomOption.value
            );
          }
          break;
        case "nested-object":
          randomizeConfig(
            field.fields,
            fullPath
          );
          break;
        case "conditional-group":
          const types = field.typeSelector.options;

          if ( types && types.length > 0 ) {
            const randomType = types[ Math.floor( Math.random() * types.length ) ];

            setValue(
              `${ fullPath }.${ field.conditionalOn }`,
              randomType.value
            );
            const specificConfig = field.configs[ randomType.value ];

            if ( specificConfig ) {
              randomizeConfig(
                specificConfig,
                fullPath
              );
            }
          }
          break;
        // Skip other types like text, textarea, image
      }
    }
  };

  const handleRandomize = ( event: React.MouseEvent ) => {
    event.stopPropagation();
    randomizeConfig(
      config,
      basePath
    );
  };

  return (
    <button
      onClick={ handleRandomize }
      className={ className }
      title="Randomize parameters"
    >
      <Shuffle className="w-3.5 h-3.5" />
    </button>
  );
}
