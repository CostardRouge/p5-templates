import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// The eight voice treatments of the title splash, one per pad of the top row.
// The order IS the pad order: option i is driven by pad 1+i.
const EFFECT_OPTIONS = [
  {
    label: "Muffled",
    value: "muffled"
  },
  {
    label: "8-bit",
    value: "8bit"
  },
  {
    label: "VBR",
    value: "vbr"
  },
  {
    label: "Laggy",
    value: "laggy"
  },
  {
    label: "Reversed",
    value: "reversed"
  },
  {
    label: "Mute",
    value: "mute"
  },
  {
    label: "Talkbox",
    value: "talkbox"
  },
  {
    label: "Formant",
    value: "formant"
  }
];

// The eight layers of the bottom row, each a toggle on its own pad.
export const LAYERS = [
  [
    "noiseFloor",
    "Noise floor"
  ],
  [
    "wowFlutter",
    "Wow & flutter"
  ],
  [
    "bitcrushEdge",
    "Bitcrush edge"
  ],
  [
    "reverbTail",
    "Reverb tail"
  ],
  [
    "sidechainDuck",
    "Sidechain duck"
  ],
  [
    "tapeHiss",
    "Tape hiss"
  ],
  [
    "doubler",
    "Doubler"
  ],
  [
    "subRumble",
    "Sub rumble"
  ]
] as const;

function layerFields() {
  const fields: Record<string, unknown> = {};

  LAYERS.forEach( (
    [
      key,
      label
    ], index
  ) => {
    fields[ key ] = {
      component: "checkbox",
      label,
      // A declared BOOLEAN binding, nothing more: the existing resolver's
      // toggle mode counts the pad's rising edges. Pads 9–16 are the bottom row.
      binding: {
        control: `pad.${ index + 9 }`,
        mapping: {
          mode: "toggle"
        }
      }
    };
  } );

  return fields;
}

// Default values only — exposed at runtime as `options.sketch.*`.
export const formValues = {
  // This sketch OWNS its interaction block, with MIDI on from the start: the
  // whole point is the controller. The port is still the user's to pick — a
  // controller map needs a single port name, and "" listens to every input.
  interaction: {
    ...interactionFormValues,
    enabled: true,
    midi: {
      ...interactionFormValues.midi,
      enabled: true
    }
  },

  rack: {
    effect: "muffled",
    layers: {
      noiseFloor: false,
      wowFlutter: true,
      bitcrushEdge: false,
      reverbTail: false,
      sidechainDuck: true,
      tapeHiss: false,
      doubler: false,
      subRumble: false
    }
  },

  look: {
    seed: 3,
    glow: 0.6
  }
};

// UI configuration only.
export const formConfiguration: Record<string, any> = {
  rack: {
    component: "nested-object",
    label: "Rack",
    initialExpanded: true,
    fields: {
      // A row of buttons, not a picker, on the top row of pads: pad.1 is the
      // first option, pad.8 the last. The pressed one lights orange.
      effect: {
        component: "select",
        label: "Effect",
        display: "buttons",
        options: EFFECT_OPTIONS,
        binding: {
          control: "pad.1"
        }
      },
      layers: {
        component: "nested-object",
        label: "Layers",
        initialExpanded: true,
        fields: layerFields()
      },
      // A button: no value, one write. Reset puts the effect back on the
      // sketch's default.
      reset: {
        component: "button",
        label: "Effect",
        variant: "danger",
        effect: {
          kind: "reset",
          target: "rack.effect"
        }
      }
    }
  },

  look: {
    component: "nested-object",
    label: "Look",
    initialExpanded: true,
    fields: {
      seed: {
        component: "slider",
        label: "Seed",
        min: 1,
        max: 99,
        step: 1,
        default: 3
      },
      // Randomize draws from the seed slider's own range — the button carries
      // no range of its own.
      regenerate: {
        component: "button",
        label: "Seed",
        effect: {
          kind: "randomize",
          target: "look.seed"
        }
      },
      glow: {
        component: "slider",
        label: "Glow",
        min: 0,
        max: 1,
        step: 0.01,
        binding: {
          control: "knob.1"
        }
      }
    }
  },

  interaction: interactionFormConfiguration
};
