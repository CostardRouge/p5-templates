"use client";

import React, {
  useSyncExternalStore
} from "react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import {
  Volume2, VolumeX
} from "lucide-react";
import clsx from "clsx";
import {
  UI_SOUND_PRESETS,
  type UiSoundSettings,
  getUiSoundSettings,
  playPreview,
  setUiSoundSettings,
  subscribeUiSoundSettings
} from "@/lib/uiSound";

/**
 * Toggle + settings popover for the editor's value-change click feedback.
 * Lives in the sketch-settings actions row (desktop panel and mobile drawer),
 * next to reset / randomize — the actions it also gives a voice to.
 */
export default function UiSoundSettingsButton( {
  className
}: {
  className?: string;
} ) {
  const settings = useSyncExternalStore(
    subscribeUiSoundSettings,
    getUiSoundSettings,
    getUiSoundSettings
  );

  const update = ( patch: Partial<UiSoundSettings> ) => {
    setUiSoundSettings( patch );
  };

  const sliderRow = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: ( next: number ) => void
  ) => (
    <label className="flex flex-col gap-0.5">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="opacity-60">{value}</span>
      </span>
      <input
        type="range"
        min={ min }
        max={ max }
        step={ step }
        value={ value }
        onChange={ ( e ) => onChange( Number( e.target.value ) ) }
      />
    </label>
  );

  const checkboxRow = (
    label: string,
    checked: boolean,
    onChange: ( next: boolean ) => void
  ) => (
    <label className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={ checked }
        onChange={ ( e ) => onChange( e.target.checked ) }
      />
    </label>
  );

  return (
    <Popover
      className="relative"
      onClick={ ( e: React.MouseEvent ) => e.stopPropagation() }
    >
      <PopoverButton
        className={ clsx(
          className,
          !settings.enabled && "opacity-50"
        ) }
        title={
          settings.enabled
            ? "UI sound feedback (on) — click for options"
            : "UI sound feedback (off) — click for options"
        }
        aria-label="UI sound feedback settings"
      >
        {settings.enabled ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
      </PopoverButton>

      <PopoverPanel
        anchor="bottom end"
        className="z-50 flex max-h-[calc(100vh-1rem)] w-64 max-w-[calc(100vw-1rem)] flex-col gap-2 overflow-y-auto rounded-xl border border-theme glass p-3 text-xs text-foreground shadow-lg [--anchor-gap:0.25rem] [--anchor-padding:0.5rem]"
      >
        {checkboxRow(
          "Sound on value change",
          settings.enabled,
          ( enabled ) => update( {
            enabled
          } )
        )}

        {checkboxRow(
          "Sound on action buttons",
          settings.actionSounds,
          ( actionSounds ) => update( {
            actionSounds
          } )
        )}

        <label className="flex items-center justify-between gap-2">
          <span>Click sound</span>
          <select
            className="rounded border border-theme bg-transparent px-1 py-0.5"
            value={ settings.preset }
            onChange={ ( e ) =>
              update( {
                preset: e.target.value as UiSoundSettings[ "preset" ]
              } ) }
          >
            {UI_SOUND_PRESETS.map( ( presetName ) => (
              <option
                key={ presetName }
                value={ presetName }
              >
                {presetName}
              </option>
            ) )}
          </select>
        </label>

        {sliderRow(
          "Volume",
          settings.volume,
          0,
          1,
          0.05,
          ( volume ) => update( {
            volume
          } )
        )}

        {sliderRow(
          "Pitch (×)",
          settings.pitch,
          0.5,
          2,
          0.05,
          ( pitch ) => update( {
            pitch
          } )
        )}

        {sliderRow(
          "Humanize",
          settings.pitchVariation,
          0,
          1,
          0.05,
          ( pitchVariation ) => update( {
            pitchVariation
          } )
        )}

        {checkboxRow(
          "Pitch varies by field",
          settings.pitchByField,
          ( pitchByField ) => update( {
            pitchByField
          } )
        )}

        {sliderRow(
          "Min gap (ms)",
          settings.minGapMs,
          0,
          300,
          5,
          ( minGapMs ) => update( {
            minGapMs
          } )
        )}

        {sliderRow(
          "Clicks per change",
          settings.repeatTimes,
          1,
          8,
          1,
          ( repeatTimes ) => update( {
            repeatTimes
          } )
        )}

        {settings.repeatTimes > 1 && (
          <>
            {sliderRow(
              "Repeat interval (ms)",
              settings.repeatIntervalMs,
              20,
              300,
              5,
              ( repeatIntervalMs ) => update( {
                repeatIntervalMs
              } )
            )}

            {sliderRow(
              "Pitch ramp (oct/click)",
              settings.repeatPitchStep,
              -0.5,
              0.5,
              0.01,
              ( repeatPitchStep ) => update( {
                repeatPitchStep
              } )
            )}
          </>
        )}

        <button
          type="button"
          className="mt-1 rounded-lg border border-theme px-2 py-1 hover:bg-hover"
          onClick={ () => playPreview() }
        >
          Test sound
        </button>
      </PopoverPanel>
    </Popover>
  );
}
