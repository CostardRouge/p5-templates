import {
  Blend
} from "@/types/sketch.types";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  // Data
  images: [
  ], // supplied via "images-stack"

  // Colors (migrated from options.json)
  background: [
    246,
    235,
    225
  ],
  text: [
    0
  ],

  // Typography / Title overlay
  font: "martian",
  title: "", // empty => uses default "PHOTO\nBALLOONS"
  showTitle: true,
  titleSize: 128,
  titleProgressStart: 0.0, // visible when progression in [start, end]
  titleProgressEnd: 0.2,
  titleBlendMode: "exclusion",

  // Motion and layout
  angleSpeed: 1, // multiplies animation.angle
  phaseJitter: 1, // scales random vx/vy offsets
  travelMargin: 100, // m: inner padding for the travel area
  minWidthAmplitude: 200, // maps 0..1 -> [minWidthAmplitude, width]
  minHeightAmplitude: 6, // maps 0..1 -> [minHeightAmplitude, height]

  // Balls (image masks)
  minBallSize: 200,
  maxBallSize: 400,

  // Links (connecting lines)
  showLines: true,
  lineColor: [
    0,
    0,
    0
  ],
  lineWeight: 1,
  lineMaxDistance: 1000, // distance used for fade mapping
  lineAlphaScale: 100, // stroke alpha = (mapped 0..1) * lineAlphaScale

  // Image drawing
  imageFill: true, // use imageUtils.marginImage fill mode
  centerImage: true // center inside buffer
};

export const formConfiguration: Record<string, any> = {
  // Data
  images: {
    component: "images-stack",
    label: "Images"
  },

  // Colors
  background: {
    component: "color",
    label: "Background color"
  },
  text: {
    component: "color",
    label: "Text color"
  },

  // Typography / Title
  font: {
    component: "select",
    label: "Font name",
    options: fontNames.map( fontName => ( {
      value: fontName,
      label: fontName
    } ) ),
  },
  title: {
    component: "text",
    label: "Custom title (leave empty for default)"
  },
  showTitle: {
    component: "checkbox",
    label: "Show title"
  },
  titleSize: {
    component: "slider",
    label: "Title size",
    min: 12,
    max: 300,
    step: 1
  },
  titleProgressStart: {
    component: "slider",
    label: "Title visible from",
    min: 0,
    max: 1,
    step: 0.001
  },
  titleProgressEnd: {
    component: "slider",
    label: "Title visible to",
    min: 0,
    max: 1,
    step: 0.001
  },
  titleBlendMode: {
    component: "select",
    label: "Title blend mode",
    options: Blend.options.map( blendOption => ( {
      value: blendOption,
      label: blendOption
    } ) )
  },

  // Motion / layout
  angleSpeed: {
    component: "slider",
    label: "Angle speed",
    min: 0,
    max: 3,
    step: 0.01
  },
  phaseJitter: {
    component: "slider",
    label: "Phase jitter",
    min: 0,
    max: 3,
    step: 0.01
  },
  travelMargin: {
    component: "slider",
    label: "Travel margin",
    min: 0,
    max: 300,
    step: 1
  },
  minWidthAmplitude: {
    component: "slider",
    label: "Min width amplitude",
    min: 0,
    max: 1000,
    step: 1
  },
  minHeightAmplitude: {
    component: "slider",
    label: "Min height amplitude",
    min: 0,
    max: 500,
    step: 1
  },

  // Balls
  minBallSize: {
    component: "slider",
    label: "Min ball size",
    min: 10,
    max: 800,
    step: 1
  },
  maxBallSize: {
    component: "slider",
    label: "Max ball size",
    min: 10,
    max: 1000,
    step: 1
  },

  // Links
  showLines: {
    component: "checkbox",
    label: "Show connecting lines"
  },
  lineColor: {
    component: "color",
    label: "Line color"
  },
  lineWeight: {
    component: "slider",
    label: "Line weight",
    min: 0,
    max: 10,
    step: 0.1
  },
  lineMaxDistance: {
    component: "slider",
    label: "Line fade max distance",
    min: 50,
    max: 2000,
    step: 1
  },
  lineAlphaScale: {
    component: "slider",
    label: "Line alpha scale",
    min: 0,
    max: 255,
    step: 1
  },

  // Image drawing
  imageFill: {
    component: "checkbox",
    label: "Fill image in buffer"
  },
  centerImage: {
    component: "checkbox",
    label: "Center image"
  }
};
