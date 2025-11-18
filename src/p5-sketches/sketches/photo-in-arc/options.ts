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

  arc: {
    anchorX: 0.5,
    anchorY: 0.75,
    radiusX: 0.5,
    radiusY: 0.5,
    startAngle: 270,
    endAngle: 90
  },

  image: {
    scale: 0.5,
    center: true
  },

  debug: {
    showPoints: false,
    pointWeight: 20,
    pointColor: [255, 0, 0] as [number, number, number]
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

  arc: {
    label: "Arc layout",
    component: "nested-object",
    fields: {
      anchorX: {
        component: "slider",
        label: "Anchor X (0–1)",
        min: 0,
        max: 1,
        step: 0.01
      },
      anchorY: {
        component: "slider",
        label: "Anchor Y (0–1)",
        min: 0,
        max: 1,
        step: 0.01
      },
      radiusX: {
        component: "slider",
        label: "Radius X (vs height)",
        min: 0,
        max: 1,
        step: 0.01
      },
      radiusY: {
        component: "slider",
        label: "Radius Y (vs width)",
        min: 0,
        max: 1,
        step: 0.01
      },
      startAngle: {
        component: "slider",
        label: "Start angle (deg)",
        min: -720,
        max: 720,
        step: 1
      },
      endAngle: {
        component: "slider",
        label: "End angle (deg)",
        min: -720,
        max: 720,
        step: 1
      }
    }
  },

  image: {
    label: "Image",
    component: "nested-object",
    fields: {
      scale: {
        component: "slider",
        label: "Scale",
        min: 0.05,
        max: 2,
        step: 0.01
      },
      center: {
        component: "checkbox",
        label: "Center"
      }
    }
  },

  debug: {
    label: "Debug",
    component: "nested-object",
    fields: {
      showPoints: {
        component: "checkbox",
        label: "Show points"
      },
      pointWeight: {
        component: "slider",
        label: "Point weight",
        min: 1,
        max: 40,
        step: 1
      },
      pointColor: {
        component: "color",
        label: "Point color"
      }
    }
  }
};
