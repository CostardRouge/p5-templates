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
      "HELLO",
      "WORLD"
    ]
  },
  textStyle: {
    font: "waverseVariable",
    size: 238,
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
    letterSpacing: 0.65
  },
  transition: {
    easing: "easeInOutExpo",
    overlap: 0.89,
    pauseRatio: 0,
    onlyChanged: false
  },
  // The mask is the *next* letter's silhouette. It scales the current letter
  // down to a point in the next letter's shape, then grows the next letter
  // back out of that same shape.
  mask: {
    show: true,
    behindLetters: true,
    maxScale: 3.2,
    easing: "easeInOutCubic",
    stroke: [
      246,
      130,
      80
    ],
    strokeWeight: 2,
    fill: [
      255,
      255,
      255,
      255
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
        label: "Mask easing function"
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
  mask: {
    component: "nested-object",
    label: "Letter mask",
    fields: {
      show: {
        component: "checkbox",
        label: "Show mask letter"
      },
      behindLetters: {
        component: "checkbox",
        label: "Draw behind letters"
      },
      maxScale: {
        component: "slider",
        label: "Max scale",
        min: 1,
        max: 12,
        step: 0.1
      },
      easing: {
        component: "easing",
        label: "Mask easing function"
      },
      stroke: {
        component: "color",
        label: "Mask outline color"
      },
      strokeWeight: {
        component: "slider",
        label: "Mask outline weight",
        min: 0,
        max: 40,
        step: 0.5
      },
      fill: {
        component: "color",
        label: "Mask fill color"
      },
      fillAlpha: {
        component: "slider",
        label: "Mask fill alpha",
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
