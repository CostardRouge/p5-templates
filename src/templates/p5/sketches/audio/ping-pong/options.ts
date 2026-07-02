import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// ── Interaction (fingers / mouse / touch / gyroscope) ──────────────────────
// Reuse the shared interaction layer but expose only the four sources this
// sketch reacts to. Each live pointer drives an extra ball (see the "Balls"
// mode select). Mouse + touch are on so switching the mode to interactive
// works instantly; vision (camera) and gyro stay off until granted. While the
// mode is "auto" (default) the pointers are ignored, so the deterministic ball
// and beat are byte-for-byte identical until the user opts in.

const interactionDefaults = {
  enabled: interactionFormValues.enabled,
  mouse: {
    ...interactionFormValues.mouse,
    enabled: true
  },
  touch: {
    ...interactionFormValues.touch,
    enabled: true
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

const BALL_MODE_OPTIONS = [
  {
    label: "Only automatic ball",
    value: "auto"
  },
  {
    label: "Auto ball + interactive",
    value: "both"
  },
  {
    label: "Interactive only",
    value: "interactive"
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
  mode: {
    composition: "auto",
    ballCollisions: false
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
        label: "Speed X (px/s, snaps to whole bounces/loop)",
        component: "slider",
        min: 0,
        max: 2000,
        step: 1
      },
      speedY: {
        label: "Speed Y (px/s, snaps to whole bounces/loop)",
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
  mode: {
    component: "nested-object",
    label: "Balls",
    fields: {
      composition: {
        label: "Mode",
        component: "select",
        options: BALL_MODE_OPTIONS
      },
      ballCollisions: {
        label: "Ball-to-ball collision sound",
        component: "checkbox"
      }
    }
  },
  interaction: interactionConfiguration
};
