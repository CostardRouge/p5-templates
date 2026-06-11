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
    radius: 40,
    speedX: 420,
    speedY: 333,
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
    sound: "bounce",
    freqMin: 220,
    freqMax: 880,
    duration: 0.15
  },
  background: {
    color: [
      0,
      0,
      0,
      255
    ] as number[]
  }
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
  }
};
