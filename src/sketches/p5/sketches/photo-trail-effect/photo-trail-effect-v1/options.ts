// photo-trail-effect-v1 — the Instagram "trail effect": pixel ribbons
// sampled across a draggable band of the photo, stretched along a curve to
// the canvas edge, with the MediaPipe-segmented subject drawn back on top.

import getTestImagePaths from "@/utils/getTestImagePaths";

const testImagePaths = await getTestImagePaths();

type TrailPoint = {x: number;
  y: number };

// One trail: `band` is the sampled cross-section (its length is the ribbon
// width, so it can cover just the body of a bird), `guides` are the
// spline-mode control points steering the ribbon toward the canvas edge,
// `flip` picks which side of the band the ribbon leaves from (angles mode)
// and `phase` (0..1) offsets the wave so trails don't oscillate in sync.
type TrailItem = {band: {a: TrailPoint;
  b: TrailPoint };
guides: {a: TrailPoint;
  b: TrailPoint };
flip: boolean;
phase: number };

export const formValues = {
  photo: {
    // A repo-shipped test photo so the sketch renders out of the box (no
    // S3/MinIO dependency); pick any image from the asset picker.
    image: testImagePaths[ 0 ] ?? "/assets/images/test/DSC02023%20Medium.jpeg",
    margin: 0.1,
    scale: 1.1,
    center: true,
    clip: false,
    fill: false
  },
  segmentation: {
    // Normalized (0-1) focus point fed to the interactive segmenter. Click
    // the canvas to move it — that is how the subject is chosen dynamically.
    roi: {
      x: 0.4720334741274328,
      y: 0.2927933578609266
    },
    inverse: true,
    edgeSoftness: 0.25,
    edgeExpand: 0
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
  trails: {
    // Number of trails. Growing appends freshly generated bands, shrinking
    // drops the tail — surviving trails keep their dragged handles.
    count: 1,
    // Normalized handles, one entry per trail. Drag them on the canvas or
    // edit them here; the count slider manages the list length.
    items: [
      {
        band: {
          a: {
            x: 0.52,
            y: 0.2
          },
          b: {
            x: 0.6255905214890259,
            y: 0.30463631511733497
          }
        },
        guides: {
          a: {
            x: 0.68,
            y: 0.3
          },
          b: {
            x: 0.9,
            y: 0.52
          }
        },
        flip: false,
        phase: 0
      }
    ] as TrailItem[]
  },
  direction: {
    // angles → launch angle + bend, no control points; spline → the two
    // draggable guide handles steer the ribbon (Chaikin corner-cutting).
    mode: "angles" as "angles" | "spline",
    // Tilt of the launch relative to the band perpendicular (degrees).
    startAngle: 0,
    // Total heading change from launch to exit (degrees) — the swoosh.
    bend: 120,
    // Where the bending happens along the ribbon.
    easing: "easeInOutSine",
    // Ribbon length as a fraction of the canvas diagonal.
    length: 0.9,
    // Also grow the ribbon the other way, mirrored through the band.
    bidirectional: true,
    // Chaikin iterations for the spline mode.
    iterations: 4
  },
  wave: {
    // Sideways sine offset, as a fraction of the smaller canvas dimension.
    amplitude: 0.1,
    // Number of full oscillations along the ribbon (the torsions).
    twists: 2,
    // Bunches the twists toward the start (>1) or the end (<1).
    warp: 1,
    // Whole wave cycles per animation loop — 0 keeps the trails still,
    // integers keep the exported video seamless.
    speed: 0
  },
  ribbon: {
    // Colour samples across the band — low values read as bold stripes.
    resolution: 96,
    // Interpolate between samples (off = hard-edged stripes).
    smoothing: true,
    opacity: 1,
    // Width multipliers at the band and at the far end (taper / flare).
    widthStart: 1,
    widthEnd: 1,
    widthEasing: "easeInOutSine",
    // Length of one ribbon slice in pixels — smaller is smoother, slower.
    sliceStep: 4
  },
  subject: {
    scale: 1,
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
  handles: {
    // Master switch for the on-canvas drag handles (band ends + guides).
    // Turn off for the final render / export.
    show: true,
    radius: 44,
    size: 16
  },
  marker: {
    show: false,
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
  segmentation: {
    label: "Segmentation",
    component: "nested-object",
    fields: {
      roi: {
        component: "vector2d",
        label: "Focus point (click the canvas)",
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
  trails: {
    label: "Trails",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      count: {
        label: "Number of trails",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      items: {
        label: "Trail handles (normalized 0..1)",
        component: "item-list",
        locked: true,
        itemConfig: {
          label: "Trail",
          component: "nested-object",
          fields: {
            band: {
              label: "Band (sampled cross-section)",
              component: "nested-object",
              fields: {
                a: {
                  label: "Start",
                  component: "vector2d",
                  min: 0,
                  max: 1,
                  step: 0.001,
                  yDown: true
                },
                b: {
                  label: "End",
                  component: "vector2d",
                  min: 0,
                  max: 1,
                  step: 0.001,
                  yDown: true
                }
              }
            },
            guides: {
              label: "Direction guides (spline mode)",
              component: "nested-object",
              fields: {
                a: {
                  label: "Guide 1",
                  component: "vector2d",
                  min: 0,
                  max: 1,
                  step: 0.001,
                  yDown: true
                },
                b: {
                  label: "Guide 2",
                  component: "vector2d",
                  min: 0,
                  max: 1,
                  step: 0.001,
                  yDown: true
                }
              }
            },
            flip: {
              label: "Flip side (angles mode)",
              component: "checkbox"
            },
            phase: {
              label: "Wave phase offset",
              component: "slider",
              min: 0,
              max: 1,
              step: 0.01
            }
          }
        }
      }
    }
  },
  direction: {
    label: "Direction",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      mode: {
        label: "Strategy",
        component: "select",
        options: [
          {
            value: "angles",
            label: "Angles (launch + bend)"
          },
          {
            value: "spline",
            label: "Spline (drag the guides)"
          }
        ]
      },
      startAngle: {
        label: "Start angle (°, from the band perpendicular)",
        component: "slider",
        min: -90,
        max: 90,
        step: 1
      },
      bend: {
        label: "End angle / bend (°)",
        component: "slider",
        min: -360,
        max: 360,
        step: 1
      },
      easing: {
        label: "Bend easing",
        component: "easing"
      },
      length: {
        label: "Length (× canvas diagonal)",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
      },
      bidirectional: {
        label: "Grow both ways",
        component: "checkbox"
      },
      iterations: {
        label: "Spline smoothing (Chaikin iterations)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      }
    }
  },
  wave: {
    label: "Wave",
    component: "nested-object",
    fields: {
      amplitude: {
        label: "Amplitude",
        component: "slider",
        min: 0,
        max: 0.4,
        step: 0.005
      },
      twists: {
        label: "Twists (oscillations)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.25
      },
      warp: {
        label: "Warp (twist distribution)",
        component: "slider",
        min: 0.3,
        max: 3,
        step: 0.05
      },
      speed: {
        label: "Animation (cycles per loop)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      }
    }
  },
  ribbon: {
    label: "Ribbon",
    component: "nested-object",
    fields: {
      resolution: {
        label: "Stripe resolution (colour samples)",
        component: "slider",
        min: 4,
        max: 512,
        step: 1
      },
      smoothing: {
        label: "Smooth stripes",
        component: "checkbox"
      },
      opacity: {
        label: "Opacity",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      widthStart: {
        label: "Width × at the band",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
      },
      widthEnd: {
        label: "Width × at the end",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      widthEasing: {
        label: "Taper easing",
        component: "easing"
      },
      sliceStep: {
        label: "Slice length (px)",
        component: "slider",
        min: 2,
        max: 16,
        step: 1
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
  handles: {
    label: "Drag handles",
    component: "nested-object",
    fields: {
      show: {
        label: "Show handles",
        component: "checkbox"
      },
      radius: {
        label: "Pick-up radius (px)",
        component: "slider",
        min: 10,
        max: 120,
        step: 1
      },
      size: {
        label: "Handle size (px)",
        component: "slider",
        min: 6,
        max: 40,
        step: 1
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
