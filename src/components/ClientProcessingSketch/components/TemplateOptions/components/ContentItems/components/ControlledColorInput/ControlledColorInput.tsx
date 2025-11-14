import React from "react";
import {
  Controller, useFormContext
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
      } ) => {
        // Ensure we always have a valid RGBA array
        const currentValue = Array.isArray(field.value) && field.value.length >= 3 
          ? field.value 
          : [0, 0, 0, 255];
        const r = currentValue[0] ?? 0;
        const g = currentValue[1] ?? 0;
        const b = currentValue[2] ?? 0;
        const a = currentValue[3] ?? 255;
        const alphaPercent = Math.round((a / 255) * 100);

        const handleColorChange = (hex: string) => {
          const [newR, newG, newB] = hexToRgba(hex);
          field.onChange([newR, newG, newB, a]); // Preserve alpha
        };

        const handleAlphaChange = (newAlpha: number) => {
          field.onChange([r, g, b, newAlpha]);
        };

        return (
          <div className="space-y-1.5">
            {/* RGB Color picker with preview */}
            <div className="flex flex-col items-center gap-2">
              <input
                type="color"
                className="h-8 w-full rounded-lg border border-theme p-0.5 cursor-pointer flex-shrink-0"
                onChange={(e) => handleColorChange(e.target.value)}
                value={rgbaToHex(currentValue)}
              />
              
            {/* Alpha control */}
            <div className="flex items-center gap-2 w-full">
              <div 
                className="w-8 h-8 rounded-lg border border-theme relative overflow-hidden"
                style={{
                  background: `linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), 
                              linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)`,
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 4px 4px'
                }}
              >
                <div 
                  className="absolute inset-0"
                  style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, ${a / 255})` }}
                />
              </div>

              <input
                type="range"
                className="p-1 border border-theme rounded-lg bg-background"
                min={0}
                max={255}
                step={1}
                value={a}
                onChange={(e) => handleAlphaChange(Number(e.target.value))}
              />
            
              <span className="text-xs font-mono bg-theme/20 px-2 py-0.5 rounded min-w-[3rem] text-center border border-theme/30 flex-shrink-0">
                {alphaPercent}%
              </span>
            </div>

            </div>
          </div>
        );
      }}
    />
  );
}
