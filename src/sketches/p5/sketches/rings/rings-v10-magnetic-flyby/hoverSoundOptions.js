// ── Form block for the fly-by hover sound ───────────────────────────────────
// Values + field config for `createHoverSounds()` (./hoverSounds.js). Split
// out for the same reason as the shared dragClickOptions module: options.ts
// is loaded by the FORM (and by the metadata generator), so it must never
// reach the audio engine — which registers the recording audio bridge on
// import and would otherwise add a silent audio track to every recording.
//
// v10's cursors never click — they only pass over the text points and tug
// them along — so the click pair (mouse down / mouse up) of v7–v9 collapses
// into a single "on over" moment: the instant a cursor's hover circle first
// touches a point. Every field ships EMPTY on purpose: which sound suits a
// mere fly-by is still an open question, so the show is silent until an
// audio file is dropped on the field (or a synth preset is picked) — there
// is no built-in default to fight against.

import {
  CLICK_PRESET_OPTIONS
} from "@/p5/utils/interaction/dragClickOptions.js";

export const hoverSoundFormValues = {
  enabled: true,
  // The "on over" sound — fired each time a cursor sweeps onto a text point.
  // Empty by default (see above): drop an audio file here to give the
  // fly-bys their voice.
  over: "",
  volume: 0.5,
  // Synth preset used when no file is uploaded ("" = stay silent).
  fallback: "",
  // Cap on simultaneous copies in one frame (a formation crossing the word
  // hits many points at once and must not stack into one loud comb).
  maxVoices: 4,
  // Deterministic per-voice detune, so those copies don't phase.
  spread: 0.04
};

export const hoverSoundFormConfiguration = {
  component: "nested-object",
  label: "Hover sound (on over)",
  fields: {
    enabled: {
      label: "Enabled",
      component: "checkbox"
    },
    over: {
      label: "On over (a cursor reaches a point)",
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
    fallback: {
      label: "Synth sound (used when the field above is empty)",
      component: "select",
      options: CLICK_PRESET_OPTIONS
    },
    maxVoices: {
      label: "Max simultaneous sounds",
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
