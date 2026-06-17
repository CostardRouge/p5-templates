import {
  webcamSourceFormConfiguration,
  webcamSourceFormValues
} from "@/p5/utils/webcam/defaults.js";
import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Default values only
export const formValues = {
  // Live camera source — the shared webcam-device-select picker. The camera is
  // owned by the sketch (MediaPipe): it is always on for the displayed feed and
  // also runs hand tracking when the Hands interaction handler is enabled, so
  // the fingertips line up with the pixels on screen.
  camera: {
    ...webcamSourceFormValues
  },

  // Grid layout
  rows: 3,
  columns: 9,

  // Per-cell effects
  blur: 6,
  displacement: 0.4,
  colorShift: 0.4,

  // Which handler drives the per-cell displacement. Pick any combination —
  // Mouse, Touch, Microphone (audio level), Hands (fingertips on the webcam).
  // Mouse / touch / audio reuse the shared interaction sources; hands run
  // MediaPipe on this sketch's own camera. With the block disabled, or with no
  // enabled handler producing a pointer, the cells fall back to a drifting
  // noise offset (the original automatic look).
  interaction: {
    enabled: true,
    mouse: {
      ...interactionFormValues.mouse
    },
    touch: {
      ...interactionFormValues.touch
    },
    audio: {
      ...interactionFormValues.audio
    },
    hands: {
      enabled: false,
      maxHands: 2
    }
  },
  // How far a pointer's pull reaches, as a fraction of the canvas.
  reach: 0.5,

  // Colors
  backgroundColor: [
    10,
    10,
    12
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  camera: webcamSourceFormConfiguration,

  rows: {
    component: "slider",
    label: "Rows",
    min: 1,
    max: 32,
    step: 1
  },

  columns: {
    component: "slider",
    label: "Columns",
    min: 1,
    max: 32,
    step: 1
  },

  blur: {
    component: "slider",
    label: "Blur",
    min: 0,
    max: 20,
    step: 0.5
  },

  displacement: {
    component: "slider",
    label: "Displacement",
    min: 0,
    max: 10,
    step: 0.01
  },

  colorShift: {
    component: "slider",
    label: "Color shift",
    min: 0,
    max: 1,
    step: 0.01
  },

  // Explicit per-handler toggles, mirroring the shared interaction panel. Mouse,
  // touch and audio reuse the shared sources verbatim; hands is sketch-owned
  // (it adds MediaPipe hand tracking to the displayed camera).
  interaction: {
    component: "nested-object",
    label: "Interaction",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Enabled"
      },
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch,
      audio: interactionFormConfiguration.fields.audio,
      hands: {
        component: "nested-object",
        label: "Hands (webcam)",
        fields: {
          enabled: {
            component: "checkbox",
            label: "Enabled"
          },
          maxHands: {
            component: "slider",
            label: "Max hands",
            min: 1,
            max: 2,
            step: 1
          }
        }
      }
    }
  },

  reach: {
    component: "slider",
    label: "Interaction reach",
    min: 0.05,
    max: 1,
    step: 0.01
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
