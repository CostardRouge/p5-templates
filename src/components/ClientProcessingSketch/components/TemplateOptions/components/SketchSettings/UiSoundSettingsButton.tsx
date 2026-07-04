"use client";

import React, {
  useSyncExternalStore
} from "react";
import {
  Popover, PopoverButton, PopoverPanel
} from "@headlessui/react";
import {
  ChevronDown, Volume2, VolumeX
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
import SliderInput
  from "../ContentItems/components/ControlledSliderInput/SliderInput";
import {
  BarLabelSegment, ToggleSwitch
} from "../ContentItems/components/ControlChrome";
import {
  CONTROL_BAR_CLASS, CONTROL_CHEVRON_CLASS
} from "../ContentItems/constants/control-bar";

/**
 * Toggle + settings popover for the editor's value-change click feedback.
 * Lives in the sketch-settings actions row (desktop panel and mobile drawer),
 * next to reset / randomize — the actions it also gives a voice to.
 *
 * The controls reuse the shared form chrome — the Blender/Leva {@link SliderInput}
 * bar, {@link ToggleSwitch} and the segmented select bar — so the panel looks and
 * feels identical to every other control in the studio, even though it is driven
 * by the UI-sound store rather than the sketch form.
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
    <SliderInput
      label={ label }
      value={ value }
      min={ min }
      max={ max }
      step={ step }
      onChange={ onChange }
    />
  );

  const toggleRow = (
    label: string,
    checked: boolean,
    onChange: ( next: boolean ) => void
  ) => (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-label">
      <span>{label}</span>
      <ToggleSwitch
        inputProps={ {
          checked,
          onChange: ( e ) => onChange( e.target.checked )
        } }
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
        className="z-[70] flex max-h-[calc(100vh-1rem)] w-64 max-w-[calc(100vw-1rem)] flex-col gap-2 overflow-y-auto rounded-xl border border-theme glass p-3 text-xs text-foreground shadow-lg [--anchor-gap:0.25rem] [--anchor-padding:0.5rem]"
      >
        {toggleRow(
          "Sound on value change",
          settings.enabled,
          ( enabled ) => update( {
            enabled
          } )
        )}

        {toggleRow(
          "Sound on action buttons",
          settings.actionSounds,
          ( actionSounds ) => update( {
            actionSounds
          } )
        )}

        <div className={ CONTROL_BAR_CLASS }>
          <BarLabelSegment label="Click sound" />

          <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
            <span className="truncate">{settings.preset}</span>
            <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
          </span>

          <select
            aria-label="Click sound"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
        </div>

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

        {toggleRow(
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
