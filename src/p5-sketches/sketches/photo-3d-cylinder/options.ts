import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  images: [
  ],

  colors: {
    background: [
      0,
      0,
      0
    ] as [number, number, number],
    text: [
      128,
      128,
      255
    ] as [number, number, number]
  },

  title: {
    show: true,
    content: "",
    font: "martian",
    size: 450,
    color: [
      128,
      128,
      255
    ] as [number, number, number],
    stroke: [
      0,
      0,
      0
    ] as [number, number, number],
    strokeWeight: 0,
    blend: "exclusion",
    align: {
      horizontal: "center",
      vertical: "center"
    },
    displayFrom: 0.0,
    displayTo: 1.0
  },

  cylinder: {
    vertical: false,
    rotateX: true,
    rotateZ: false,
    zoom: -2000,
    variableZoom: false
  },

  animation: {
    duration: 8,
    framerate: 60,
    variableBackgroundColor: true
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
        options: fontNames.map( fontName => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Size",
        component: "slider",
        min: 12,
        max: 800,
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
          {
            value: "blend",
            label: "Blend"
          },
          {
            value: "darkest",
            label: "Darkest"
          },
          {
            value: "lightest",
            label: "Lightest"
          },
          {
            value: "difference",
            label: "Difference"
          },
          {
            value: "multiply",
            label: "Multiply"
          },
          {
            value: "exclusion",
            label: "Exclusion"
          },
          {
            value: "screen",
            label: "Screen"
          },
          {
            value: "overlay",
            label: "Overlay"
          },
          {
            value: "hard-light",
            label: "Hard Light"
          },
          {
            value: "soft-light",
            label: "Soft Light"
          },
          {
            value: "dodge",
            label: "Dodge"
          },
          {
            value: "burn",
            label: "Burn"
          },
          {
            value: "add",
            label: "Add"
          },
          {
            value: "subtract",
            label: "Subtract"
          }
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
              {
                value: "left",
                label: "Left"
              },
              {
                value: "center",
                label: "Center"
              },
              {
                value: "right",
                label: "Right"
              }
            ]
          },
          vertical: {
            label: "Vertical",
            component: "select",
            options: [
              {
                value: "top",
                label: "Top"
              },
              {
                value: "center",
                label: "Center"
              },
              {
                value: "bottom",
                label: "Bottom"
              },
              {
                value: "baseline",
                label: "Baseline"
              }
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

  cylinder: {
    label: "Cylinder",
    component: "nested-object",
    fields: {
      vertical: {
        component: "checkbox",
        label: "Vertical orientation"
      },
      rotateX: {
        component: "checkbox",
        label: "Rotate X"
      },
      rotateZ: {
        component: "checkbox",
        label: "Rotate Z"
      },
      zoom: {
        component: "slider",
        label: "Zoom (Z translate)",
        min: -10000,
        max: 1000,
        step: 10
      },
      variableZoom: {
        component: "checkbox",
        label: "Animated zoom"
      }
    }
  },

  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      duration: {
        component: "slider",
        label: "Duration (seconds)",
        min: 1,
        max: 60,
        step: 0.5
      },
      framerate: {
        component: "slider",
        label: "Framerate",
        min: 1,
        max: 120,
        step: 1
      },
      variableBackgroundColor: {
        component: "checkbox",
        label: "Animated background color"
      }
    }
  }
};

