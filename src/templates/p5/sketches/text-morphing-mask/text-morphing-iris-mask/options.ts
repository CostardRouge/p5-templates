import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  createSingleOrMultipleTextOption
} from "@/utils/sketchOptionUtils";

export const formValues = {
  text: {
    mode: "single",
    value: "hello world"
  },
  textStyle: {
    font: "waverseVariable",
    size: 320,
    letterSpacing: 0.62,
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
    strokeWeight: 0
  },
  transition: {
    easing: "easeInOutCubic",
    pauseRatio: 0.2,
    overlap: 0.3,
    onlyChanged: false
  },
  circle: {
    show: true,
    easing: "easeInOutCubic",
    maxRadius: 0.55,
    behindLetters: true,
    fill: [
      255,
      255,
      255
    ],
    fillAlpha: 0,
    stroke: [
      255,
      255,
      255
    ],
    strokeWeight: 2
  },
  backgroundColor: [
    0,
    0,
    0
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  text: createSingleOrMultipleTextOption( "text" ),
  textStyle: {
    component: "nested-object",
    label: "Text style",
    fields: {
      font: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Size (px)",
        component: "slider",
        min: 40,
        max: 800,
        step: 1
      },
      letterSpacing: {
        label: "Letter spacing",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
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
        max: 50,
        step: 0.5
      }
    }
  },
  transition: {
    component: "nested-object",
    label: "Transition",
    fields: {
      easing: {
        component: "easing",
        label: "Transition easing function"
      },
      pauseRatio: {
        label: "Pause ratio",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      overlap: {
        label: "Letter overlap",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      onlyChanged: {
        label: "Only animate changed letters?",
        component: "checkbox"
      }
    }
  },
  circle: {
    component: "nested-object",
    label: "Iris circle",
    fields: {
      show: {
        label: "Show circle?",
        component: "checkbox"
      },
      easing: {
        component: "easing",
        label: "Circle easing function"
      },
      maxRadius: {
        label: "Max radius (of min dimension)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      behindLetters: {
        label: "Draw behind letters?",
        component: "checkbox"
      },
      fill: {
        label: "Fill",
        component: "color"
      },
      fillAlpha: {
        label: "Fill alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      stroke: {
        label: "Stroke",
        component: "color"
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 50,
        step: 0.5
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
