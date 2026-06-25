import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  createSingleOrMultipleTextOption
} from "@/utils/sketchOptionUtils";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

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
  mask: {
    show: true,
    easing: "easeInOutCubic",
    maxScale: 6,
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
  ],
  title: titleDefaultValues
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
  mask: {
    component: "nested-object",
    label: "Letter mask",
    fields: {
      show: {
        label: "Show mask letter?",
        component: "checkbox"
      },
      easing: {
        component: "easing",
        label: "Mask easing function"
      },
      maxScale: {
        label: "Max scale",
        component: "slider",
        min: 1,
        max: 12,
        step: 0.5
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
  },
  title: titleFormConfiguration
};
