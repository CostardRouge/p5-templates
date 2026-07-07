import {
  fontSelectOptions
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  getTestVideoPath
} from "@/utils/getTestVideoPaths";

// Default values only
export const formValues = {
  videos: [
    {
      id: "test-gradient-flow",
      path: await getTestVideoPath( "gradient-flow" ),
      params: {
        repeat: 1,
        speed: 1,
        offset: 0,
        loopMode: "loop",
        scale: 1,
        posX: 0,
        posY: 0,
        fit: "cover"
      }
    }
  ],
  blur: 0,

  text: "video\ntext\nmask",
  font: "waverseVariable",
  fontSize: 24,
  align: "center",
  lineHeight: 1,
  margin: 0,
  textPosition: {
    x: 0.5,
    y: 0.5
  },
  style: "fill",
  outlineWeight: 8,
  invert: false,

  backgroundColor: [
    10,
    10,
    12
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  videos: {
    component: "asset-stack",
    kind: "videos",
    label: "Videos"
  },

  blur: {
    component: "slider",
    label: "Video blur",
    min: 0,
    max: 20,
    step: 1
  },

  text: {
    component: "textarea",
    label: "Text"
  },

  font: {
    component: "select",
    label: "Font",
    options: fontSelectOptions
  },

  fontSize: {
    component: "slider",
    label: "Font size (% of height)",
    min: 5,
    max: 150,
    step: 1
  },

  align: {
    component: "select",
    label: "Alignment",
    options: [
      {
        label: "Left",
        value: "left"
      },
      {
        label: "Center",
        value: "center"
      },
      {
        label: "Right",
        value: "right"
      }
    ]
  },

  lineHeight: {
    component: "slider",
    label: "Line height",
    min: 0.7,
    max: 2,
    step: 0.05
  },

  margin: {
    component: "slider",
    label: "Margin (px)",
    min: 0,
    max: 400,
    step: 1
  },

  textPosition: {
    component: "vector2d",
    label: "Text position",
    allowNegative: false,
    min: 0,
    max: 1,
    step: 0.01,
    yDown: true
  },

  style: {
    component: "select",
    label: "Style",
    options: [
      {
        label: "Fill",
        value: "fill"
      },
      {
        label: "Outline",
        value: "outline"
      }
    ]
  },

  outlineWeight: {
    component: "slider",
    label: "Outline weight",
    min: 1,
    max: 40,
    step: 1
  },

  invert: {
    component: "checkbox",
    label: "Invert (video around the text)"
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
