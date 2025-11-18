import { fontNames } from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  images: [],

  colors: {
    background: [246, 235, 225] as [number, number, number],
    text: [0] as [number]
  },

  title: {
    show: true,
    content: "",
    font: "martian",
    size: 128,
    color: [0] as [number],
    stroke: [246, 235, 225] as [number, number, number],
    strokeWeight: 2,
    blend: "exclusion",
    align: {
      horizontal: "center",
      vertical: "center"
    },
    displayFrom: 0.0,
    displayTo: 0.2
  },

  motion: {
    angleSpeed: 1,
    phaseJitter: 1,
    travelMargin: 100,
    minWidthAmplitude: 200,
    minHeightAmplitude: 6
  },

  balls: {
    minSize: 200,
    maxSize: 400
  },

  lines: {
    show: true,
    color: [0, 0, 0] as [number, number, number],
    weight: 1,
    maxDistance: 1000,
    alphaScale: 100
  },

  image: {
    fill: true,
    center: true
  }
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },

  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      background: {
        component: "color",
        label: "Background color"
      },
      text: {
        component: "color",
        label: "Text color"
      }
    }
  },

  title: {
    label: "Title",
    component: "nested-object",
    fields: {
      show: {
        label: "Show title",
        component: "checkbox"
      },
      content: {
        label: "Custom title",
        component: "text",
        placeholder: "Leave empty to use sketch name"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontNames.map(fontName => ({
          value: fontName,
          label: fontName
        }))
      },
      size: {
        label: "Size",
        component: "slider",
        min: 12,
        max: 300,
        step: 1
      },
      color: {
        label: "Color",
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
        max: 20,
        step: 0.5
      },
      blend: {
        label: "Blend mode",
        component: "select",
        options: [
          { value: "blend", label: "Blend" },
          { value: "darkest", label: "Darkest" },
          { value: "lightest", label: "Lightest" },
          { value: "difference", label: "Difference" },
          { value: "multiply", label: "Multiply" },
          { value: "exclusion", label: "Exclusion" },
          { value: "screen", label: "Screen" },
          { value: "overlay", label: "Overlay" },
          { value: "hard-light", label: "Hard Light" },
          { value: "soft-light", label: "Soft Light" },
          { value: "dodge", label: "Dodge" },
          { value: "burn", label: "Burn" },
          { value: "add", label: "Add" },
          { value: "subtract", label: "Subtract" }
        ]
      },
      align: {
        label: "Alignment",
        component: "nested-object",
        fields: {
          horizontal: {
            label: "Horizontal",
            component: "select",
            options: [
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" }
            ]
          },
          vertical: {
            label: "Vertical",
            component: "select",
            options: [
              { value: "top", label: "Top" },
              { value: "center", label: "Center" },
              { value: "bottom", label: "Bottom" },
              { value: "baseline", label: "Baseline" }
            ]
          }
        }
      },
      displayFrom: {
        label: "Display from (0-1)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      displayTo: {
        label: "Display to (0-1)",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  motion: {
    label: "Motion",
    component: "nested-object",
    fields: {
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
      }
    }
  },

  balls: {
    label: "Balls",
    component: "nested-object",
    fields: {
      minSize: {
        component: "slider",
        label: "Min size",
        min: 10,
        max: 800,
        step: 1
      },
      maxSize: {
        component: "slider",
        label: "Max size",
        min: 10,
        max: 1000,
        step: 1
      }
    }
  },

  lines: {
    label: "Connecting lines",
    component: "nested-object",
    fields: {
      show: {
        component: "checkbox",
        label: "Show lines"
      },
      color: {
        component: "color",
        label: "Color"
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 0,
        max: 10,
        step: 0.1
      },
      maxDistance: {
        component: "slider",
        label: "Fade max distance",
        min: 50,
        max: 2000,
        step: 1
      },
      alphaScale: {
        component: "slider",
        label: "Alpha scale",
        min: 0,
        max: 255,
        step: 1
      }
    }
  },

  image: {
    label: "Image",
    component: "nested-object",
    fields: {
      fill: {
        component: "checkbox",
        label: "Fill in buffer"
      },
      center: {
        component: "checkbox",
        label: "Center"
      }
    }
  }
};
