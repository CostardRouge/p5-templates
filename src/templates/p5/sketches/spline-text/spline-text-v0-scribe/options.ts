import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    value: "HELLO",
    font: "waverseVariable",
    size: 0.2,
    sampleFactor: 0.2,
    simplifyThreshold: 0,
    visible: true,
    fade: true,
    color: [
      255,
      255,
      255,
      70
    ] as number[]
  },
  points: {
    count: 149,
    travelDetail: 0.2,
    seed: 0,
    motion: 0.08,
    speed: 1
  },
  morph: {
    // "progressive" reveals the points left → right (letter by letter); "instant"
    // morphs them all together.
    mode: "instant" as "progressive" | "instant",
    assemble: 0.35,
    hold: 0.2,
    spread: 0.56,
    easing: "easeInOutCubic"
  },
  curve: {
    method: "chaikin" as "chaikin" | "catmull-rom" | "quadratic",
    iterations: 4,
    closed: false,
    tension: 0
  },
  stroke: {
    weight: 8,
    glow: 2,
    weightStart: 1,
    weightEnd: 1,
    weightEasing: "linear",
    hueSpeed: 1,
    hueSpread: 1.5,
    hueOffset: 0,
    hueEasing: "linear",
    gradient: true
  },
  overlay: {
    polygon: {
      show: false,
      weight: 2,
      color: [
        255,
        255,
        255,
        60
      ] as number[],
      dashed: true,
      dash: 14,
      gap: 10
    },
    points: {
      show: false,
      size: 10,
      coreRatio: 0.4,
      color: [
        255,
        255,
        255,
        255
      ] as number[],
      coreColor: [
        10,
        10,
        14,
        255
      ] as number[]
    }
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  text: {
    label: "Text",
    component: "nested-object",
    fields: {
      value: {
        label: "Text",
        component: "text"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontSelectOptions
      },
      size: {
        label: "Size (× smallest canvas side)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      sampleFactor: {
        label: "Outline precision (sample factor)",
        component: "slider",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      simplifyThreshold: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      visible: {
        label: "Show the text underneath?",
        component: "checkbox"
      },
      fade: {
        label: "Fade text in with the morph?",
        component: "checkbox"
      },
      color: {
        label: "Text color",
        component: "color"
      }
    }
  },
  points: {
    label: "Spline points",
    component: "nested-object",
    fields: {
      count: {
        label: "Control point count",
        component: "slider",
        min: 3,
        max: 200,
        step: 1
      },
      travelDetail: {
        label: "Detail away from the word (× points)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      seed: {
        label: "Random seed",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      motion: {
        label: "Random drift amount",
        component: "slider",
        min: 0,
        max: 0.25,
        step: 0.005
      },
      speed: {
        label: "Random drift speed (snaps to whole turns/loop)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      }
    }
  },
  morph: {
    label: "Morph animation",
    component: "nested-object",
    fields: {
      mode: {
        label: "Assembly mode",
        component: "select",
        options: [
          {
            label: "Progressive (letter by letter)",
            value: "progressive"
          },
          {
            label: "Instant (all at once)",
            value: "instant"
          }
        ]
      },
      assemble: {
        label: "Assemble (fraction of loop)",
        component: "slider",
        min: 0.05,
        max: 0.9,
        step: 0.01
      },
      hold: {
        label: "Hold on text (fraction of loop)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      spread: {
        label: "Stagger spread (progressive only)",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.01
      },
      easing: {
        label: "Morph easing",
        component: "easing"
      }
    }
  },
  curve: {
    label: "Curve",
    component: "nested-object",
    fields: {
      method: {
        label: "Rounding method",
        component: "select",
        options: [
          {
            label: "Chaikin (corner-cutting)",
            value: "chaikin"
          },
          {
            label: "Catmull-Rom (curveVertex)",
            value: "catmull-rom"
          },
          {
            label: "Quadratic (midpoints)",
            value: "quadratic"
          }
        ]
      },
      iterations: {
        label: "Chaikin iterations",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      closed: {
        label: "Closed loop?",
        component: "checkbox"
      },
      tension: {
        label: "Catmull-Rom tension",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      }
    }
  },
  stroke: {
    label: "Stroke",
    component: "nested-object",
    fields: {
      weight: {
        label: "Weight (middle of the curve)",
        component: "slider",
        min: 1,
        max: 40,
        step: 0.5
      },
      weightStart: {
        label: "Weight × at start (open curves only)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      weightEnd: {
        label: "Weight × at end (open curves only)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      weightEasing: {
        label: "Weight taper easing",
        component: "easing"
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed (over time) (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread along path (Chaikin only)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      hueEasing: {
        label: "Hue spread easing",
        component: "easing"
      },
      gradient: {
        label: "Gradient along path (Chaikin only)",
        component: "checkbox"
      }
    }
  },
  overlay: {
    label: "Demonstration overlay",
    component: "nested-object",
    fields: {
      polygon: {
        label: "Raw polygon",
        component: "nested-object",
        fields: {
          show: {
            label: "Show raw polygon",
            component: "checkbox"
          },
          weight: {
            label: "Weight",
            component: "slider",
            min: 0.5,
            max: 12,
            step: 0.5
          },
          color: {
            label: "Color",
            component: "color"
          },
          dashed: {
            label: "Dashed?",
            component: "checkbox"
          },
          dash: {
            label: "Dash length",
            component: "slider",
            min: 1,
            max: 80,
            step: 1
          },
          gap: {
            label: "Gap length",
            component: "slider",
            min: 0,
            max: 80,
            step: 1
          }
        }
      },
      points: {
        label: "Points",
        component: "nested-object",
        fields: {
          show: {
            label: "Show points",
            component: "checkbox"
          },
          size: {
            label: "Size (diameter)",
            component: "slider",
            min: 0,
            max: 60,
            step: 0.5
          },
          coreRatio: {
            label: "Inner core ratio",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.02
          },
          color: {
            label: "Color",
            component: "color"
          },
          coreColor: {
            label: "Inner core color",
            component: "color"
          }
        }
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
