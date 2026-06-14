import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    content: "WEAVE",
    font: "martian",
    size: 240,
    letterSpacing: 8,
    fill: [
      235,
      235,
      240,
      255
    ] as number[],
    stroke: [
      0,
      0,
      0,
      255
    ] as number[],
    strokeWeight: 0
  },
  // Normalised screen position of the word's centre. { x: 0.5, y: 0.5 } is the
  // middle of the canvas (the pad's Y axis points down to match screen space).
  position: {
    x: 0.5,
    y: 0.5
  },
  spiral: {
    // When true the coil dives behind and surfaces in front of the letters
    // (the weave). When false it is a flat ribbon drawn entirely in front.
    weave: true,
    // How many full loops the coil makes across the word.
    turns: 7,
    // Vertical reach of the coil as a fraction of the text size (controls how
    // far above / below the letters' centre the loops swing).
    heightRatio: 0.62,
    // Horizontal "fold" of each loop as a fraction of the text size. Larger
    // values make the coil fold back on itself into rounder loops.
    loopWidthRatio: 0.3,
    // Shifts where along each loop the coil crosses from behind to in front,
    // so you can tune which strands read as over vs under.
    depthPhase: 0,
    // How far the coil overshoots the word on each side, in units of text size.
    extend: 0.6,
    // Resolution of the coil before the spline smoothing — more points = a
    // cleaner curve through tight loops.
    pointCount: 240,
    // Animation speed of the travelling helix (0 freezes it).
    speed: 1,
    // Spin the coil clockwise (1) or counter-clockwise (-1).
    direction: 1 as 1 | -1
  },
  curve: {
    // Chaikin corner-cutting passes applied by the shared splines renderer.
    iterations: 4
  },
  stroke: {
    weight: 16,
    glow: 3,
    weightStart: 1,
    weightEnd: 1,
    weightEasing: "linear",
    hueSpeed: 1,
    hueSpread: 1.5,
    hueOffset: 0,
    hueEasing: "linear",
    // Off by default so the behind and in-front passes share one uniform hue and
    // the weave reads as a single continuous wire. Turn on for a rainbow coil
    // (the gradient restarts at each over/under crossing).
    gradient: false
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
      letterSpacing: {
        label: "Letter spacing",
        component: "slider",
        min: -40,
        max: 120,
        step: 1
      },
      fill: {
        label: "Fill",
        component: "color"
      },
      stroke: {
        label: "Stroke",
        component: "color"
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 20,
        step: 0.5
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
  spiral: {
    label: "Spiral (weave)",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      weave: {
        label: "Weave through letters",
        component: "checkbox"
      },
      turns: {
        label: "Turns (loops across word)",
        component: "slider",
        min: 1,
        max: 24,
        step: 0.5
      },
      depthPhase: {
        label: "Over/under crossing phase",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      heightRatio: {
        label: "Height × text size",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.01
      },
      loopWidthRatio: {
        label: "Loop width × text size",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      extend: {
        label: "Overshoot × text size",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.05
      },
      pointCount: {
        label: "Point count",
        component: "slider",
        min: 16,
        max: 600,
        step: 1
      },
      speed: {
        label: "Animation speed",
        component: "slider",
        min: 0,
        max: 6,
        step: 0.1
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
