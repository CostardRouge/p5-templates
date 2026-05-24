import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

const fontOptions = fontNames.map( ( fontName ) => ( {
  value: fontName,
  label: fontName
} ) );

const palette = [
  {
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
    fill: [
      29,
      53,
      87
    ],
    stroke: [
      241,
      250,
      238
    ],
    background: [
      168,
      218,
      220
    ]
  },
  {
    fill: [
      255,
      255,
      255
    ],
    stroke: [
      0,
      0,
      0
    ],
    background: [
      69,
      123,
      157
    ]
  },
  {
    fill: [
      33,
      37,
      41
    ],
    stroke: [
      255,
      214,
      10
    ],
    background: [
      255,
      214,
      10
    ]
  },
  {
    fill: [
      255,
      0,
      110
    ],
    stroke: [
      255,
      255,
      255
    ],
    background: [
      58,
      12,
      163
    ]
  },
  {
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

const defaultTexts = [
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX"
];

const defaultFaceFonts = [
  "martian",
  "stardom",
  "sans",
  "agiro",
  "waverseVariable",
  "tilt"
];

const defaultFaces = defaultTexts.map( (
  text, index
) => ( {
  text,
  font: defaultFaceFonts[ index ],
  sizeFactor: 1,
  fill: palette[ index ].fill,
  stroke: palette[ index ].stroke,
  strokeWeight: 2,
  background: palette[ index ].background,
  jitter: 0,
  outlineOnly: false
} ) );

export const formValues = {
  faces: [
    {
      text: "ONE",
      font: "martian",
      sizeFactor: 0.14,
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
      strokeWeight: 4.5,
      background: [
        230,
        57,
        70
      ],
      jitter: 0,
      outlineOnly: false
    },
    {
      text: "TWO",
      font: "openSans",
      sizeFactor: 0.16,
      fill: [
        29,
        53,
        87
      ],
      stroke: [
        241,
        250,
        238
      ],
      strokeWeight: 4,
      background: [
        168,
        218,
        220
      ],
      jitter: 0,
      outlineOnly: false
    },
    {
      text: "THREE",
      font: "sans",
      sizeFactor: 0.18,
      fill: [
        255,
        255,
        255
      ],
      stroke: [
        0,
        0,
        0
      ],
      strokeWeight: 4.5,
      background: [
        69,
        123,
        157
      ],
      jitter: 0,
      outlineOnly: false
    },
    {
      text: "FOUR",
      font: "agiro",
      sizeFactor: 1,
      fill: [
        33,
        37,
        41
      ],
      stroke: [
        255,
        214,
        10
      ],
      strokeWeight: 2,
      background: [
        255,
        214,
        10
      ],
      jitter: 0,
      outlineOnly: false
    },
    {
      text: "FIVE",
      font: "waverseVariable",
      sizeFactor: 1,
      fill: [
        255,
        0,
        110
      ],
      stroke: [
        255,
        255,
        255
      ],
      strokeWeight: 2,
      background: [
        58,
        12,
        163
      ],
      jitter: 0,
      outlineOnly: false
    },
    {
      text: "SIX",
      font: "tilt",
      sizeFactor: 1,
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
      strokeWeight: 2,
      background: [
        8,
        28,
        21
      ],
      jitter: 0,
      outlineOnly: false
    }
  ],

  backgroundColor: [
    246,
    235,
    225
  ],

  diceSizeFactor: 1.5,
  faceScale: 0.58,

  rotateSpeed: 0.29,
  easing: "easeInOutExpo",

  rollMode: false,
  autoFitText: true,

  baseTextSize: 285,

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
          options: fontOptions
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
    label: "Face content scale",
    min: 0.1,
    max: 2,
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
    label: "Roll mode (random face order)"
  },

  title: titleFormConfiguration
};
