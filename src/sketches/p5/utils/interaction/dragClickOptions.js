// ── Shared form block for drag click sounds ───────────────────────────────
// Values + field config for `createDragClicks()` (./dragClicks.js). Import
// into any sketch's options.ts that has a draggable layer:
//
//   import { dragClickFormValues, dragClickFormConfiguration }
//     from "@/p5/utils/interaction/dragClickOptions.js";
//
//   export const formValues = { …, sound: { ...dragClickFormValues } };
//   export const formConfiguration = { …, sound: dragClickFormConfiguration };
//
// Kept free of imports on purpose: options.ts is loaded by the FORM (and by
// the metadata generator), so it must never reach the audio engine — which
// registers the recording audio bridge on import and would otherwise add a
// silent audio track to every sketch's recordings.

export const dragClickFormValues = {
  enabled: true,
  // Uploaded sounds, one per edge of the "click". Empty = use the synth preset.
  down: "",
  up: "",
  volume: 0.6,
  // Whether the scripted pointer troupe clicks too (off = only real hands do).
  virtual: true,
  // Built-in synth click used while no sound is uploaded ("" = silent).
  fallback: "click",
  // Cap on simultaneous copies of the same sound in one frame (a crowd of
  // cursors grabbing together must not stack into one loud comb).
  maxVoices: 3,
  // Deterministic per-voice detune, so those copies don't phase.
  spread: 0.04
};

// Mirrors `CLICK_PRESET_NAMES` in @/lib/clickSynth. Duplicated as plain data
// rather than imported so this module stays dependency-free (the synth is TS
// and lives on the app side).
export const CLICK_PRESET_OPTIONS = [
  {
    value: "",
    label: "None (silent without an asset)"
  },
  {
    value: "click",
    label: "Click"
  },
  {
    value: "tick",
    label: "Tick"
  },
  {
    value: "blip",
    label: "Blip"
  },
  {
    value: "pop",
    label: "Pop"
  },
  {
    value: "beep",
    label: "Beep"
  },
  {
    value: "wood",
    label: "Wood"
  },
  {
    value: "typewriter",
    label: "Typewriter"
  }
];

export const dragClickFormConfiguration = {
  component: "nested-object",
  label: "Click sounds",
  fields: {
    enabled: {
      label: "Enabled",
      component: "checkbox"
    },
    down: {
      label: "Mouse down (grab a point)",
      component: "asset",
      kind: "audios"
    },
    up: {
      label: "Mouse up (release a point)",
      component: "asset",
      kind: "audios"
    },
    volume: {
      label: "Volume",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01
    },
    virtual: {
      label: "Virtual pointers click too",
      component: "checkbox"
    },
    fallback: {
      label: "Synth click (used when no sound is uploaded)",
      component: "select",
      options: CLICK_PRESET_OPTIONS
    },
    maxVoices: {
      label: "Max simultaneous clicks",
      component: "slider",
      min: 1,
      max: 8,
      step: 1
    },
    spread: {
      label: "Detune spread",
      component: "slider",
      min: 0,
      max: 0.3,
      step: 0.01
    }
  }
};
