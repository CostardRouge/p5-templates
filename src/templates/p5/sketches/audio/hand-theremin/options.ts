import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // One palm point per hand for the playhead; mouse plays too by default.
  interaction: {
    ...interactionFormValues,
    mouse: {
      ...interactionFormValues.mouse,
      enabled: true
    },
    vision: {
      ...interactionFormValues.vision,
      enabled: true,
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: true,
        landmarks: {
          fingertips: false,
          palm: true
        }
      }
    }
  },

  backgroundColor: [
    8,
    8,
    14
  ],

  // The synthesised instrument
  instrument: {
    scale: "pentatonic",
    rootMidi: 45,
    octaves: 2,
    notesPerSecond: 6,
    noteLength: 0.22,
    volume: 0.5,
    pinchThreshold: 0.55,
    mousePlays: true
  },

  // The visual answer to every note
  visuals: {
    showLanes: true,
    showHand: true,
    handSize: 60,
    handGlow: 3,
    rippleSize: 0.3,
    rippleSpeed: 0.012
  },

  // Overlay text
  overlay: {
    show: true,
    caption: "🔊 conducted by hand · no instrument touched"
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  interaction: interactionFormConfiguration,

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  instrument: {
    component: "nested-object",
    label: "Instrument",
    initialExpanded: true,
    fields: {
      scale: {
        component: "select",
        label: "Scale",
        options: [
          {
            label: "Pentatonic minor",
            value: "pentatonic"
          },
          {
            label: "Major",
            value: "major"
          },
          {
            label: "Minor",
            value: "minor"
          },
          {
            label: "Chromatic",
            value: "chromatic"
          }
        ]
      },
      rootMidi: {
        component: "slider",
        label: "Root note (MIDI)",
        min: 24,
        max: 72,
        step: 1
      },
      octaves: {
        component: "slider",
        label: "Octave range",
        min: 1,
        max: 4,
        step: 1
      },
      notesPerSecond: {
        component: "slider",
        label: "Notes per second",
        min: 1,
        max: 16,
        step: 1
      },
      noteLength: {
        component: "slider",
        label: "Note length (s)",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      volume: {
        component: "slider",
        label: "Volume",
        min: 0,
        max: 1,
        step: 0.05
      },
      pinchThreshold: {
        component: "slider",
        label: "Pinch threshold (octave up)",
        min: 0,
        max: 1,
        step: 0.05
      },
      mousePlays: {
        component: "checkbox",
        label: "Mouse plays when no hand is tracked"
      }
    }
  },

  visuals: {
    component: "nested-object",
    label: "Visuals",
    fields: {
      showLanes: {
        component: "checkbox",
        label: "Show scale lanes"
      },
      showHand: {
        component: "checkbox",
        label: "Show hand dot"
      },
      handSize: {
        component: "slider",
        label: "Hand dot size",
        min: 10,
        max: 300,
        step: 5
      },
      handGlow: {
        component: "slider",
        label: "Hand glow layers",
        min: 1,
        max: 12,
        step: 1
      },
      rippleSize: {
        component: "slider",
        label: "Ripple size (× canvas width)",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      rippleSpeed: {
        component: "slider",
        label: "Ripple speed (× canvas width / frame)",
        min: 0.002,
        max: 0.05,
        step: 0.001
      }
    }
  },

  overlay: {
    component: "nested-object",
    label: "Overlay text",
    fields: {
      show: {
        component: "checkbox",
        label: "Show caption"
      },
      caption: {
        component: "text",
        label: "Caption"
      }
    }
  }
};
