import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  field: {
    rows: 140,
    cols: 134,
    verticalMargin: 0.185,
    horizontalMargin: 0,
    amplitude: 0.115,
    colFreq: 0.05,
    rowFreq: 0.12,
    morphRadius: 0.6,
    ridge: 3,
    octaves: 3
  },
  palette: {
    saturation: 0.28,
    hueSpread: 1.0,
    weight: 0.0022
  },
  hud: {
    show: true,
    label: "SIGNALS",
    color: [
      180,
      230,
      210
    ]
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  field: {
    component: "nested-object",
    label: "Field",
    fields: {
      rows: {
        label: "Rows (ridges)",
        component: "slider",
        min: 8,
        max: 140,
        step: 1
      },
      cols: {
        label: "Columns (resolution)",
        component: "slider",
        min: 20,
        max: 320,
        step: 1
      },
      verticalMargin: {
        label: "Vertical margin",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.005
      },
      horizontalMargin: {
        label: "Horizontal margin",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.005
      },
      amplitude: {
        label: "Relief amplitude",
        component: "slider",
        min: 0,
        max: 0.3,
        step: 0.005
      },
      colFreq: {
        label: "Column frequency",
        component: "slider",
        min: 0.05,
        max: 4,
        step: 0.05
      },
      rowFreq: {
        label: "Row frequency",
        component: "slider",
        min: 0.05,
        max: 4,
        step: 0.05
      },
      morphRadius: {
        label: "Morph radius (motion)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      ridge: {
        label: "Ridge sharpness",
        component: "slider",
        min: 0.5,
        max: 4,
        step: 0.1
      },
      octaves: {
        label: "Noise octaves",
        component: "slider",
        min: 1,
        max: 6,
        step: 1
      }
    }
  },
  palette: {
    component: "nested-object",
    label: "Palette",
    fields: {
      saturation: {
        label: "Saturation (low = elegant)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      weight: {
        label: "Line weight (× width)",
        component: "slider",
        min: 0.0005,
        max: 0.01,
        step: 0.0005
      }
    }
  },
  hud: {
    component: "nested-object",
    label: "Instrument (HUD)",
    fields: {
      show: {
        label: "Show instrument frame",
        component: "checkbox"
      },
      label: {
        label: "Header label",
        component: "text"
      },
      color: {
        label: "HUD color",
        component: "color"
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
