import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  PALETTE_OPTIONS,
  ballsValues,
  ballsConfig,
  gridValues,
  gridConfig
} from "../_options";

export const formValues = {
  balls: ballsValues,
  grid: gridValues,
  stroke: {
    weight: 5,
    rainbow: true,
    palette: "rainbow",
    hueSpeed: 1,
    color: [
      255,
      255,
      255,
      255
    ]
  },
  debug: {
    showGrid: false,
    showSamples: false,
    showBalls: false
  },
  backgroundColor: [
    8,
    8,
    14,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  balls: ballsConfig,
  grid: gridConfig,
  stroke: {
    label: "Contour",
    component: "nested-object",
    fields: {
      weight: {
        label: "Line weight",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.5
      },
      rainbow: {
        label: "Rainbow coloring",
        component: "checkbox"
      },
      palette: {
        label: "Palette",
        component: "select",
        options: PALETTE_OPTIONS
      },
      hueSpeed: {
        label: "Hue scroll speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      color: {
        label: "Solid color (rainbow off)",
        component: "color"
      }
    }
  },
  debug: {
    label: "Debug overlay",
    component: "nested-object",
    fields: {
      showGrid: {
        label: "Show grid lines",
        component: "checkbox"
      },
      showSamples: {
        label: "Show inside/outside samples",
        component: "checkbox"
      },
      showBalls: {
        label: "Show source balls",
        component: "checkbox"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
