import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  photo: {
    // A bundled test image: a `global/...` S3 path only resolves for the
    // account that uploaded it, so it 404s (and used to hang the loader)
    // for everyone else.
    image: ( await getTestImagePaths() )[ 0 ],
    margin: 0.1,
    scale: 1.1,
    center: true,
    clip: false,
    fill: false
  },
  // The auto-focus walk: a seeded noise loop that "clicks" points of interest
  // on its own, revealing a different mask on every pick.
  auto: {
    enabled: true,
    seed: 0,
    picksPerLoop: 8,
    // Noise-circle radius: small = smooth drift between picks, large = jumps.
    variety: 1,
    // Wander range from the photo centre, per axis.
    spreadX: 0.9,
    spreadY: 0.9,
    // Keep picks away from the photo edges.
    margin: 0.08
  },
  segmentation: {
    // Normalized (0-1) focus point. Driven by the auto walk when enabled;
    // click the canvas (or use the 2D pad) to pick manually.
    roi: {
      x: 0.5,
      y: 0.5
    },
    inverse: true,
    // Feather the cut-out border so the mask blends instead of showing the hard,
    // aliased model edge. 0 = crisp, 1 = very soft.
    edgeSoftness: 0.25,
    // Grow (positive) or shrink (negative) the mask to trim a halo of
    // background pixels or recover a sliver of the subject.
    edgeExpand: 0
  },
  background: {
    // transparent · original · color · blur · dim
    mode: "blur",
    color: [
      246,
      235,
      225
    ],
    blur: 12,
    dim: 0.45
  },
  subject: {
    // Pop the cut-out subject out of its frame.
    scale: 0.99,
    shadow: {
      enabled: true,
      blur: 28,
      color: [
        0,
        0,
        0,
        90
      ],
      offsetX: 0,
      offsetY: 18
    }
  },
  marker: {
    show: true,
    color: [
      255,
      255,
      255
    ],
    radius: 61,
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
  auto: {
    label: "Auto focus",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      seed: {
        label: "Seed",
        component: "slider",
        min: 0,
        max: 1000,
        step: 1
      },
      picksPerLoop: {
        label: "Picks per loop",
        component: "slider",
        min: 1,
        max: 32,
        step: 1
      },
      variety: {
        label: "Variety",
        component: "slider",
        min: 0.05,
        max: 3,
        step: 0.05
      },
      spreadX: {
        label: "Horizontal spread",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      spreadY: {
        label: "Vertical spread",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      margin: {
        label: "Edge margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.01
      }
    }
  },
  segmentation: {
    label: "Segmentation",
    component: "nested-object",
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
