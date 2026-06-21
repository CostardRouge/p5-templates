import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

import {
  createSingleOrMultipleTextOption
} from "@/utils/sketchOptionUtils";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  // The word(s) to morph through. "multiple" cycles word → word; "single"
  // splits the entered string on whitespace into the same word sequence.
  text: {
    mode: "multiple",
    value: [
      "DREAM",
      "DREAD",
      "BREAD",
      "BREAK"
    ]
  },
  textStyle: {
    font: "waverseVariable",
    size: 360,
    fill: [
      245,
      235,
      225
    ],
    stroke: [
      245,
      235,
      225
    ],
    strokeWeight: 0,
    letterSpacing: 0.62
  },
  transition: {
    easing: "easeInOutCubic",
    overlap: 0.35,
    pauseRatio: 0.15,
    onlyChanged: false
  },
  circle: {
    show: true,
    behindLetters: true,
    maxRadius: 0.55,
    easing: "easeInOutCubic",
    stroke: [
      246,
      130,
      80
    ],
    strokeWeight: 3,
    fill: [
      0,
      0,
      0
    ],
    fillAlpha: 0
  },
  backgroundColor: [
    12,
    12,
    16
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
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
        component: "slider",
        label: "Letter size",
        min: 20,
        max: 1000,
        step: 1
      },
      fill: {
        component: "color",
        label: "Letter fill color"
      },
      stroke: {
        component: "color",
        label: "Letter outline color"
      },
      strokeWeight: {
        component: "slider",
        label: "Letter outline weight",
        min: 0,
        max: 60,
        step: 1
      },
      letterSpacing: {
        component: "slider",
        label: "Letter spacing",
        min: 0.2,
        max: 1.5,
        step: 0.01
      }
    }
  },
  transition: {
    component: "nested-object",
    label: "Transition",
    fields: {
      easing: {
        component: "easing",
        label: "Iris easing function"
      },
      overlap: {
        component: "slider",
        label: "Letters overlap",
        min: 0,
        max: 1,
        step: 0.01
      },
      pauseRatio: {
        component: "slider",
        label: "Pause on full word",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      onlyChanged: {
        component: "checkbox",
        label: "Animate only changed letters"
      }
    }
  },
  circle: {
    component: "nested-object",
    label: "Mask circle",
    fields: {
      show: {
        component: "checkbox",
        label: "Show circle"
      },
      behindLetters: {
        component: "checkbox",
        label: "Draw behind letters"
      },
      maxRadius: {
        component: "slider",
        label: "Max radius (screen ratio)",
        min: 0.05,
        max: 1.2,
        step: 0.01
      },
      easing: {
        component: "easing",
        label: "Circle easing function"
      },
      stroke: {
        component: "color",
        label: "Circle outline color"
      },
      strokeWeight: {
        component: "slider",
        label: "Circle outline weight",
        min: 0,
        max: 40,
        step: 0.5
      },
      fill: {
        component: "color",
        label: "Circle fill color"
      },
      fillAlpha: {
        component: "slider",
        label: "Circle fill alpha",
        min: 0,
        max: 255,
        step: 1
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
