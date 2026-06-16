import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

// Six bold, high-contrast face presets. Text fill reads against its own face
// background; the stroke gives the lettering a clean outline on every face.
const facePresets = [
  {
    text: "ONE",
    font: "martian",
    fill: [
      246,
      235,
      225
    ],
    stroke: [
      30,
      30,
      30
    ],
    background: [
      230,
      57,
      70
    ]
  },
  {
    text: "TWO",
    font: "stardom",
    fill: [
      241,
      250,
      238
    ],
    stroke: [
      29,
      53,
      87
    ],
    background: [
      69,
      123,
      157
    ]
  },
  {
    text: "THREE",
    font: "sans",
    fill: [
      33,
      37,
      41
    ],
    stroke: [
      255,
      255,
      255
    ],
    background: [
      168,
      218,
      220
    ]
  },
  {
    text: "FOUR",
    font: "agiro",
    fill: [
      33,
      37,
      41
    ],
    stroke: [
      33,
      37,
      41
    ],
    background: [
      255,
      214,
      10
    ]
  },
  {
    text: "FIVE",
    font: "waverseVariable",
    fill: [
      255,
      255,
      255
    ],
    stroke: [
      58,
      12,
      163
    ],
    background: [
      131,
      56,
      236
    ]
  },
  {
    text: "SIX",
    font: "tilt",
    fill: [
      8,
      217,
      214
    ],
    stroke: [
      8,
      28,
      21
    ],
    background: [
      8,
      28,
      21
    ]
  }
];

const faces = facePresets.map( ( preset ) => ( {
  text: preset.text,
  font: preset.font,
  sizeFactor: 1,
  fill: preset.fill,
  stroke: preset.stroke,
  strokeWeight: 3,
  background: preset.background,
  jitter: 0,
  outlineOnly: false
} ) );

export const formValues = {
  faces,

  backgroundColor: [
    246,
    235,
    225
  ],

  diceSizeFactor: 1.5,
  faceScale: 1,

  baseTextSize: 280,
  autoFitText: true,
  textPadding: 0.12,

  rotateSpeed: 0.3,
  easing: "easeInOutExpo",

  rollMode: false,
  rollSeed: 1,

  title: titleDefaultValues
};

export const formConfiguration: Record<string, any> = {
  faces: {
    component: "item-list",
    label: "Faces (up to 6, repeats if fewer)",
    minItems: 1,
    maxItems: 6,
    itemConfig: {
      component: "nested-object",
      label: "Face",
      fields: {
        text: {
          component: "text",
          label: "Text"
        },
        font: {
          component: "select",
          label: "Font",
          options: fontSelectOptions
        },
        sizeFactor: {
          component: "slider",
          label: "Size factor",
          min: 0.1,
          max: 3,
          step: 0.01
        },
        fill: {
          component: "color",
          label: "Text fill"
        },
        stroke: {
          component: "color",
          label: "Text stroke"
        },
        strokeWeight: {
          component: "slider",
          label: "Stroke weight",
          min: 0,
          max: 20,
          step: 0.5
        },
        background: {
          component: "color",
          label: "Face background"
        },
        jitter: {
          component: "slider",
          label: "Rotation jitter (deg)",
          min: -180,
          max: 180,
          step: 1
        },
        outlineOnly: {
          component: "checkbox",
          label: "Outline only (no fill)"
        }
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Canvas background"
  },

  diceSizeFactor: {
    component: "slider",
    label: "Dice size factor",
    min: 0.1,
    max: 9,
    step: 0.01
  },
  faceScale: {
    component: "slider",
    label: "Face fill (1 = full face)",
    min: 0.1,
    max: 1,
    step: 0.01
  },

  baseTextSize: {
    component: "slider",
    label: "Base text size (px)",
    min: 20,
    max: 600,
    step: 1
  },
  autoFitText: {
    component: "checkbox",
    label: "Auto-fit text to face"
  },
  textPadding: {
    component: "slider",
    label: "Text padding",
    min: 0,
    max: 0.4,
    step: 0.01
  },

  rotateSpeed: {
    component: "slider",
    label: "Rotation speed",
    min: 0,
    max: 3,
    step: 0.01
  },
  easing: {
    component: "easing",
    label: "Rotation easing"
  },

  rollMode: {
    component: "checkbox",
    label: "Roll mode (shuffled face order)"
  },
  rollSeed: {
    component: "slider",
    label: "Roll seed",
    min: 0,
    max: 999,
    step: 1
  },

  title: titleFormConfiguration
};
