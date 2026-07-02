import {
  blendSelectOptions,
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  shape: {
    text: "x",
    font: "waverseVariable",
    size: 1.3,
    sampleFactor: 0.1,
    simplifyThreshold: 0,
    closeContours: true,
    contourBreakThreshold: 0.075
  },
  render: {
    mode: "lines-and-points",
    skipFactor: 9,
    pointSize: 56,
    blendMode: "source-over"
  },
  stroke: {
    weightMin: 7.5,
    weightMax: 26,
    weightEasing: "easeInOutBack",
    pulseSpeed: 4
  },
  displacement: {
    enabled: true,
    amount: 0.028,
    noiseScale: 8.3,
    animSpeed: 2.1
  },
  rotation: {
    enabled: false,
    xMultiplier: 0,
    yMultiplier: 1,
    zMultiplier: 0,
    angleMax: 6.283185307179586,
    easing: "easeInExpo"
  },
  color: {
    palette: "rainbow",
    opacityFactor: 1.6,
    fillAlphaStart: 255,
    fillAlphaEnd: 255,
    fillEasing: "easeInOutSine",
    strokeAlpha: 214,
    hueMultiplier: 2.7,
    hueOffset: 1.04840734641021,
    hueAnimSpeed: 2,
    hueNoiseScale: 0.9
  },
  backgroundColor: [
    246,
    235,
    225
  ]
};

const paletteOptions = [
  "rainbow",
  "rainbowCrazy",
  "test",
  "darkBlueYellow",
  "purple",
  "purpleSimple",
  "green",
  "black"
].map( ( value ) => ( {
  value,
  label: value
} ) );

const renderModeOptions = [
  {
    value: "lines",
    label: "Lines"
  },
  {
    value: "points",
    label: "Points"
  },
  {
    value: "lines-and-points",
    label: "Lines + Points"
  }
];

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      text: {
        label: "Text",
        component: "text"
      },
      font: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      sampleFactor: {
        label: "Text sample factor",
        component: "slider",
        min: 0.01,
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
      closeContours: {
        label: "Close contours (loop each subpath)",
        component: "checkbox"
      },
      contourBreakThreshold: {
        label: "Contour break threshold (relative)",
        component: "slider",
        min: 0.005,
        max: 0.5,
        step: 0.005
      }
    }
  },
  render: {
    component: "nested-object",
    label: "Render",
    fields: {
      mode: {
        label: "Render mode",
        component: "select",
        options: renderModeOptions
      },
      skipFactor: {
        label: "Skip every N points",
        component: "slider",
        min: 1,
        max: 20,
        step: 1
      },
      pointSize: {
        label: "Point size (points mode)",
        component: "slider",
        min: 1,
        max: 80,
        step: 1
      },
      blendMode: {
        label: "Blend mode",
        component: "select",
        options: blendSelectOptions
      }
    }
  },
  stroke: {
    component: "nested-object",
    label: "Stroke",
    fields: {
      weightMin: {
        label: "Stroke weight (min)",
        component: "slider",
        min: 0,
        max: 80,
        step: 0.5
      },
      weightMax: {
        label: "Stroke weight (max)",
        component: "slider",
        min: 0,
        max: 80,
        step: 0.5
      },
      weightEasing: {
        label: "Stroke pulse easing",
        component: "easing"
      },
      pulseSpeed: {
        label: "Stroke pulse speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },
  displacement: {
    component: "nested-object",
    label: "Displacement (noise wobble)",
    fields: {
      enabled: {
        label: "Enable displacement?",
        component: "checkbox"
      },
      amount: {
        label: "Amount (relative to canvas)",
        component: "slider",
        min: 0,
        max: 0.1,
        step: 0.001
      },
      noiseScale: {
        label: "Noise scale",
        component: "slider",
        min: 0.1,
        max: 20,
        step: 0.1
      },
      animSpeed: {
        label: "Animation speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },
  rotation: {
    component: "nested-object",
    label: "Rotation (3D)",
    fields: {
      enabled: {
        label: "Enable rotation?",
        component: "checkbox"
      },
      xMultiplier: {
        label: "X multiplier",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      yMultiplier: {
        label: "Y multiplier",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      zMultiplier: {
        label: "Z multiplier",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.1
      },
      angleMax: {
        label: "Max angle (radians)",
        component: "slider",
        min: 0,
        max: Math.PI * 4,
        step: 0.01
      },
      easing: {
        label: "Rotation easing",
        component: "easing"
      }
    }
  },
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      palette: {
        label: "Palette",
        component: "select",
        options: paletteOptions
      },
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      },
      fillAlphaStart: {
        label: "Fill alpha (visible)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      fillAlphaEnd: {
        label: "Fill alpha (hidden)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      fillEasing: {
        label: "Fill easing",
        component: "easing"
      },
      strokeAlpha: {
        label: "Stroke alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      hueMultiplier: {
        label: "Hue range multiplier",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.1
      },
      hueOffset: {
        label: "Hue offset",
        component: "slider",
        min: -Math.PI,
        max: Math.PI,
        step: 0.01
      },
      hueAnimSpeed: {
        label: "Hue animation speed (snaps to whole cycles/loop)",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      hueNoiseScale: {
        label: "Hue noise scale",
        component: "slider",
        min: 0.1,
        max: 10,
        step: 0.1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
