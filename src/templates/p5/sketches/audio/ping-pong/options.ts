import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// ── Interaction (fingers / mouse / touch / gyroscope) ──────────────────────
// Reuse the shared interaction layer but expose only the four sources this
// sketch reacts to. Every source starts OFF so the deterministic ball + beat
// are byte-for-byte identical until the user opts in; flip one on and its live
// pointers become bumpers the ball plays a bip off of.

const interactionDefaults = {
  enabled: interactionFormValues.enabled,
  mouse: {
    ...interactionFormValues.mouse,
    enabled: false
  },
  touch: {
    ...interactionFormValues.touch,
    enabled: false
  },
  vision: {
    ...interactionFormValues.vision,
    enabled: false,
    // When the camera is switched on, track fingers (not the whole hand).
    fingers: {
      ...interactionFormValues.vision.fingers,
      enabled: true
    }
  },
  gyroscope: {
    ...interactionFormValues.gyroscope,
    enabled: false
  },
  visualization: {
    ...interactionFormValues.visualization,
    enabled: false
  }
};

// A fingers-focused slice of the shared Vision panel (drop hands/face/body).
const visionFingersConfiguration = {
  component: "nested-object",
  label: "Vision (Camera) — fingers",
  fields: {
    enabled: interactionFormConfiguration.fields.vision.fields.enabled,
    source: interactionFormConfiguration.fields.vision.fields.source,
    fingers: interactionFormConfiguration.fields.vision.fields.fingers,
    performance: interactionFormConfiguration.fields.vision.fields.performance
  }
};

const interactionConfiguration = {
  component: "nested-object",
  label: "Interaction",
  fields: {
    enabled: interactionFormConfiguration.fields.enabled,
    mouse: interactionFormConfiguration.fields.mouse,
    touch: interactionFormConfiguration.fields.touch,
    vision: visionFingersConfiguration,
    gyroscope: interactionFormConfiguration.fields.gyroscope,
    visualization: interactionFormConfiguration.fields.visualization
  }
};

const SOUND_OPTIONS = [
  {
    label: "Bounce (triangle, pitch drop)",
    value: "bounce"
  },
  {
    label: "Beep (sine)",
    value: "beep"
  },
  {
    label: "Tick (noise click)",
    value: "tick"
  }
];

export const formValues = {
  ball: {
    radius: 186,
    speedX: 666,
    speedY: 666,
    color: [
      255,
      255,
      255,
      255
    ] as number[]
  },
  flash: {
    show: true,
    duration: 0.35,
    size: 4
  },
  audio: {
    enabled: true,
    volume: 0.8,
    sound: "beep",
    freqMin: 220,
    freqMax: 819,
    duration: 0.55
  },
  background: {
    color: [
      0,
      0,
      0,
      255
    ] as number[]
  },
  bumpers: {
    show: true,
    radius: 80
  },
  interaction: interactionDefaults
};

export const formConfiguration: Record<string, any> = {
  ball: {
    component: "nested-object",
    label: "Ball",
    fields: {
      radius: {
        label: "Radius",
        component: "slider",
        min: 5,
        max: 200,
        step: 1
      },
      speedX: {
        label: "Speed X (px/s)",
        component: "slider",
        min: 0,
        max: 2000,
        step: 1
      },
      speedY: {
        label: "Speed Y (px/s)",
        component: "slider",
        min: 0,
        max: 2000,
        step: 1
      },
      color: {
        component: "color",
        label: "Color"
      }
    }
  },
  flash: {
    component: "nested-object",
    label: "Bounce flash",
    fields: {
      show: {
        label: "Show",
        component: "checkbox"
      },
      duration: {
        label: "Duration (s)",
        component: "slider",
        min: 0.05,
        max: 2,
        step: 0.05
      },
      size: {
        label: "Size factor",
        component: "slider",
        min: 0.5,
        max: 12,
        step: 0.5
      }
    }
  },
  audio: {
    component: "nested-object",
    label: "Audio",
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      volume: {
        label: "Volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      sound: {
        label: "Sound",
        component: "select",
        options: SOUND_OPTIONS
      },
      freqMin: {
        label: "Frequency min (Hz)",
        component: "slider",
        min: 40,
        max: 2000,
        step: 1
      },
      freqMax: {
        label: "Frequency max (Hz)",
        component: "slider",
        min: 40,
        max: 4000,
        step: 1
      },
      duration: {
        label: "Bip duration (s)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      }
    }
  },
  background: {
    component: "nested-object",
    label: "Background",
    fields: {
      color: {
        component: "color",
        label: "Background color"
      }
    }
  },
  bumpers: {
    component: "nested-object",
    label: "Interactive bumpers",
    fields: {
      show: {
        label: "Show bumper rings",
        component: "checkbox"
      },
      radius: {
        label: "Bumper radius (px)",
        component: "slider",
        min: 10,
        max: 300,
        step: 1
      }
    }
  },
  interaction: interactionConfiguration
};
