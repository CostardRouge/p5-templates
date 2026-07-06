import {
  interactionFormValues,
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";

// Photo trail: cut the subject out of a photo (click it — MediaPipe interactive
// segmentation) and pour a flowing colour trail out from behind it. The trail is
// drawn UNDER the cut-out subject but OVER the rest of the photo. Its direction
// is a draggable spline (normalized 0..1 control points, saved with the
// template), and its width follows a size-progression easing along its length.
export const formValues = {
  photo: {
    image: "global/images/DSC02455.jpg",
    margin: 0.1,
    scale: 1.1,
    center: true,
    clip: false,
    fill: false
  },

  segmentation: {
    // Normalized (0-1) focus point fed to the interactive segmenter. Click the
    // canvas to move it; it is also editable from the 2D pad below.
    roi: {
      x: 0.44326979424839197,
      y: 0.5386447230522758
    },
    inverse: true,
    edgeSoftness: 0.25,
    edgeExpand: 0
  },

  trail: {
    enabled: true,
    // How many colour strands make up the band.
    strands: 28,
    // Band base half-width as a fraction of the smaller canvas side.
    width: 0.24,
    // Size progression along the trail (root → tip), as multipliers of `width`,
    // interpolated through `widthEasing`. Default: wide at the subject, pinching
    // to a point at the tip.
    widthStart: 1,
    widthEnd: 0.12,
    widthEasing: "easeOutQuad",
    // Per-strand line thickness + how far the band flows along the spline.
    weight: 4,
    length: 1,
    // Outer strands stop shorter so the tip fans out instead of ending square.
    tipSpread: 0.4,
    // Alpha fade toward each strand's tip (0 = solid, 1 = fully dissolves).
    fade: 0.65,
    glow: 1,
    opacity: 1,
    // "source-over" keeps true colours; "screen" makes the streaks glow additively.
    blend: "source-over",
    // photo · gradient · rainbow
    colorMode: "photo",
    colorA: [
      255,
      120,
      40
    ],
    colorB: [
      40,
      180,
      255
    ],
    hueOffset: 0,
    hueSpread: 1,
    // Draggable direction spline. Drag the handles on the canvas; the list is
    // also editable in the form. Points are normalized [0..1].
    spline: {
      showHandles: true,
      items: [
        {
          x: 0.3,
          y: 0.62
        },
        {
          x: 0.44,
          y: 0.52
        },
        {
          x: 0.6,
          y: 0.46
        },
        {
          x: 0.76,
          y: 0.4
        },
        {
          x: 0.9,
          y: 0.3
        }
      ] as Array<{ x: number;
        y: number }>
    },
    // Pick-up radius (px) around a handle for grabbing it.
    grabRadius: 44
  },

  background: {
    // transparent · original · color · blur · dim
    mode: "original",
    color: [
      246,
      235,
      225
    ],
    blur: 12,
    dim: 0.45
  },

  subject: {
    scale: 1,
    shadow: {
      enabled: true,
      blur: 24,
      color: [
        0,
        0,
        0,
        80
      ],
      offsetX: 0,
      offsetY: 12
    }
  },

  // Mouse + touch drive dragging the spline handles. Touch MUST stay enabled so
  // the viewport hands the touchscreen to the sketch instead of panning.
  interaction: {
    ...interactionFormValues,
    mouse: {
      ...interactionFormValues.mouse,
      enabled: true
    },
    touch: {
      ...interactionFormValues.touch,
      enabled: true
    },
    vision: {
      ...interactionFormValues.vision,
      enabled: false
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    visualization: {
      ...interactionFormValues.visualization,
      enabled: false
    }
  },

  marker: {
    show: false,
    color: [
      255,
      255,
      255
    ],
    radius: 40,
    weight: 3
  },

  backgroundColor: [
    246,
    235,
    225
  ]
};

export const formConfiguration: Record<string, any> = {
  photo: {
    label: "Photo",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      image: {
        component: "image",
        label: "Image"
      },
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005
      },
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      center: {
        label: "Center",
        component: "checkbox"
      },
      clip: {
        label: "Clip",
        component: "checkbox"
      },
      fill: {
        label: "Fill",
        component: "checkbox"
      }
    }
  },

  segmentation: {
    label: "Segmentation",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      roi: {
        component: "vector2d",
        label: "Focus point",
        allowNegative: false,
        min: 0,
        max: 1,
        step: 0.01,
        yDown: true
      },
      inverse: {
        label: "Inverse mask",
        component: "checkbox"
      },
      edgeSoftness: {
        label: "Edge softness",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      edgeExpand: {
        label: "Edge expand",
        component: "slider",
        min: -1,
        max: 1,
        step: 0.01
      }
    }
  },

  trail: {
    label: "Trail",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      strands: {
        label: "Strands",
        component: "slider",
        min: 1,
        max: 120,
        step: 1
      },
      width: {
        label: "Band width",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.005
      },
      widthStart: {
        label: "Size at root (×)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      widthEnd: {
        label: "Size at tip (×)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      widthEasing: {
        label: "Size progression easing",
        component: "easing"
      },
      weight: {
        label: "Strand weight",
        component: "slider",
        min: 0.5,
        max: 24,
        step: 0.5
      },
      length: {
        label: "Length",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      tipSpread: {
        label: "Tip fan-out",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fade: {
        label: "Tip fade",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      opacity: {
        label: "Opacity",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      blend: {
        label: "Blend mode",
        component: "select",
        options: [
          {
            label: "Normal",
            value: "source-over"
          },
          {
            label: "Screen (glow)",
            value: "screen"
          }
        ]
      },
      colorMode: {
        label: "Colour source",
        component: "select",
        options: [
          {
            label: "Sampled from photo",
            value: "photo"
          },
          {
            label: "Gradient (A → B)",
            value: "gradient"
          },
          {
            label: "Rainbow",
            value: "rainbow"
          }
        ]
      },
      colorA: {
        label: "Gradient colour A",
        component: "color"
      },
      colorB: {
        label: "Gradient colour B",
        component: "color"
      },
      hueOffset: {
        label: "Rainbow hue offset",
        component: "slider",
        min: 0,
        max: 360,
        step: 1
      },
      hueSpread: {
        label: "Rainbow hue spread",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.05
      },
      spline: {
        label: "Direction spline",
        component: "nested-object",
        initialExpanded: true,
        fields: {
          showHandles: {
            label: "Show drag handles",
            component: "checkbox"
          },
          items: {
            label: "Control points (drag on canvas)",
            component: "item-list",
            minItems: 2,
            maxItems: 24,
            itemConfig: {
              label: "Point",
              component: "vector2d",
              min: 0,
              max: 1,
              step: 0.001,
              yDown: true
            }
          }
        }
      },
      grabRadius: {
        label: "Handle pick-up radius (px)",
        component: "slider",
        min: 10,
        max: 120,
        step: 1
      }
    }
  },

  background: {
    label: "Background",
    component: "nested-object",
    fields: {
      mode: {
        label: "Mode",
        component: "select",
        options: [
          {
            value: "transparent",
            label: "Transparent"
          },
          {
            value: "original",
            label: "Original photo"
          },
          {
            value: "color",
            label: "Solid color"
          },
          {
            value: "blur",
            label: "Blurred photo"
          },
          {
            value: "dim",
            label: "Dimmed photo"
          }
        ]
      },
      color: {
        label: "Color",
        component: "color"
      },
      blur: {
        label: "Blur amount",
        component: "slider",
        min: 0,
        max: 40,
        step: 1
      },
      dim: {
        label: "Dim amount",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  subject: {
    label: "Subject",
    component: "nested-object",
    fields: {
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.5,
        max: 2,
        step: 0.01
      },
      shadow: {
        label: "Drop shadow",
        component: "nested-object",
        fields: {
          enabled: {
            label: "Enabled",
            component: "checkbox"
          },
          blur: {
            label: "Blur",
            component: "slider",
            min: 0,
            max: 80,
            step: 1
          },
          color: {
            label: "Color",
            component: "color"
          },
          offsetX: {
            label: "Offset X",
            component: "slider",
            min: -80,
            max: 80,
            step: 1
          },
          offsetY: {
            label: "Offset Y",
            component: "slider",
            min: -80,
            max: 80,
            step: 1
          }
        }
      }
    }
  },

  interaction: {
    component: "nested-object",
    label: "Input sources",
    fields: {
      enabled: interactionFormConfiguration.fields.enabled,
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch
    }
  },

  marker: {
    label: "Focus marker",
    component: "nested-object",
    fields: {
      show: {
        label: "Show marker",
        component: "checkbox"
      },
      color: {
        label: "Color",
        component: "color"
      },
      radius: {
        label: "Radius",
        component: "slider",
        min: 0,
        max: 100,
        step: 1
      },
      weight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Canvas color"
  }
};
