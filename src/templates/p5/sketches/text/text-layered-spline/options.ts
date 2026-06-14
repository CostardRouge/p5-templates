import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    content: "WEAVE",
    font: "martian",
    size: 200,
    // Letter colour. The glyph mask is cached white and tinted to this, so the
    // colour can change every frame without re-rasterising the font.
    fill: [
      235,
      235,
      240,
      255
    ] as number[]
  },
  // Normalised screen position of the word's centre. { x: 0.5, y: 0.5 } is the
  // middle of the canvas (the pad's Y axis points down to match screen space).
  position: {
    x: 0.5,
    y: 0.5
  },
  helix: {
    // How many full loops the coil makes across the word.
    turns: 5,
    // Vertical reach of the coil (rise / fall on screen), as a fraction of size.
    radiusY: 0.6,
    // Depth reach of the coil (how far it swings in front of / behind the text),
    // as a fraction of size. This is what drives the front/back weave; set it to
    // 0 for a perfectly flat ribbon (no weave).
    radiusZ: 0.6,
    // How far the coil overshoots the word on each side, in units of text size.
    extend: 0.4,
    // Resolution of the helix — more points = a smoother curve through the loops.
    pointCount: 260,
    // Animation speed of the winding phase (0 freezes it). Animating it slides
    // the front/back crossings along the word so letters are revealed in turn.
    speed: 1,
    // Static phase offset to pick where the coil sits along its cycle.
    phaseOffset: 0,
    // Wind clockwise (1) or counter-clockwise (-1).
    direction: 1 as 1 | -1
  },
  camera: {
    // Perspective makes the far side of the coil recede (the round-spiral look);
    // off = orthographic (a flat, even projection — the weave still reads via the
    // front/back layering).
    perspective: true,
    // Tilt the coil so its depth reads as a real spiral in space.
    tiltX: 0.3,
    tiltY: 0
  },
  curve: {
    // Chaikin corner-cutting passes applied by the shared splines renderer.
    iterations: 4
  },
  stroke: {
    weight: 16,
    glow: 3,
    // Variable thickness along the (open) arcs — both at 1 = a uniform tube.
    weightStart: 1,
    weightEnd: 1,
    weightEasing: "linear",
    hueSpeed: 1,
    // Rainbow swept along the coil. The hue can restart at a front/back crossing,
    // but those mostly fall over the letters where they're hidden; turn gradient
    // off for one uniform hue if you want a single continuous wire.
    hueSpread: 1.5,
    hueOffset: 0,
    hueEasing: "linear",
    gradient: true
  },
  backgroundColor: [
    8,
    8,
    12,
    255
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  text: {
    label: "Text",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      content: {
        label: "Content",
        component: "text"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontSelectOptions
      },
      size: {
        label: "Size",
        component: "slider",
        min: 40,
        max: 600,
        step: 1
      },
      fill: {
        label: "Fill",
        component: "color"
      }
    }
  },
  position: {
    label: "Position",
    component: "vector2d",
    allowNegative: false,
    min: 0,
    max: 1,
    step: 0.01,
    yDown: true
  },
  helix: {
    label: "Helix (spiral)",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      turns: {
        label: "Turns (loops across word)",
        component: "slider",
        min: 1,
        max: 24,
        step: 0.5
      },
      radiusY: {
        label: "Vertical reach × size",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      radiusZ: {
        label: "Depth reach × size (front/back)",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      extend: {
        label: "Overshoot × size",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      pointCount: {
        label: "Point count",
        component: "slider",
        min: 16,
        max: 800,
        step: 1
      },
      speed: {
        label: "Animation speed",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.1
      },
      phaseOffset: {
        label: "Phase offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      direction: {
        label: "Direction",
        component: "select",
        asNumber: true,
        options: [
          {
            label: "Clockwise",
            value: 1
          },
          {
            label: "Counter-clockwise",
            value: -1
          }
        ]
      }
    }
  },
  camera: {
    label: "Camera",
    component: "nested-object",
    fields: {
      perspective: {
        label: "Perspective",
        component: "checkbox"
      },
      tiltX: {
        label: "Tilt X",
        component: "slider",
        min: -Math.PI / 2,
        max: Math.PI / 2,
        step: 0.01
      },
      tiltY: {
        label: "Tilt Y",
        component: "slider",
        min: -Math.PI / 2,
        max: Math.PI / 2,
        step: 0.01
      }
    }
  },
  curve: {
    label: "Curve",
    component: "nested-object",
    fields: {
      iterations: {
        label: "Chaikin iterations",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      }
    }
  },
  stroke: {
    label: "Stroke (spline)",
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
        label: "Weight × at start",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      weightEnd: {
        label: "Weight × at end",
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
        label: "Hue speed (over time)",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread along path",
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
        label: "Gradient along path",
        component: "checkbox"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
