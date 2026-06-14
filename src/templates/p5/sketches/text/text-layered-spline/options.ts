import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  text: {
    content: "WEAVE",
    font: "martian",
    size: 200,
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
  helix: {
    // How many full loops the coil makes across the word.
    turns: 5,
    // Vertical reach of the coil (rise / fall on screen), as a fraction of size.
    radiusY: 0.6,
    // Depth reach of the coil (how far it swings in front of / behind the text),
    // as a fraction of size. This is what drives the front/back occlusion; set
    // it to 0 for a perfectly flat ribbon (no weave).
    radiusZ: 0.6,
    // Stroke thickness of the coil.
    thickness: 16,
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
    // Orthographic = flat, even weave. Off = perspective (the far side recedes).
    orthographic: false,
    // Tilt the whole scene to expose the coil's depth as a real spiral in space.
    // A small default tilt reads as a 3D coil even on a still frame; set both to
    // 0 for a dead-on view where only the occlusion gives the weave away.
    tiltX: 0.3,
    tiltY: 0
  },
  stroke: {
    // Off = one uniform hue (shifts over time) so the coil reads as a single
    // continuous wire. On = a rainbow swept along the coil.
    gradient: false,
    hueSpeed: 1,
    hueSpread: 1.5,
    hueOffset: 0
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
      thickness: {
        label: "Thickness",
        component: "slider",
        min: 1,
        max: 80,
        step: 0.5
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
      orthographic: {
        label: "Orthographic (flat)",
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
  stroke: {
    label: "Stroke",
    component: "nested-object",
    fields: {
      gradient: {
        label: "Gradient along path",
        component: "checkbox"
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
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
