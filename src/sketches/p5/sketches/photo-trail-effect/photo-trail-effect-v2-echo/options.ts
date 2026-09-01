// photo-trail-effect-v2-echo — the "echo" trail: fading, shrinking,
// optionally tinted ghost copies of the MediaPipe-segmented subject stamped
// along a draggable curve, with the cut-out drawn back on top.

import getTestImagePaths from "@/utils/getTestImagePaths";

const testImagePaths = await getTestImagePaths();

type TrailPoint = {x: number;
  y: number };

// The ghost path handles: `anchor` is where the trail leaves the subject
// (drop it on the subject's centre), `guides` are the spline-mode control
// points steering the trail.
type TrailHandles = {anchor: TrailPoint;
  guides: {a: TrailPoint;
    b: TrailPoint } };

export const formValues = {
  photo: {
    // A repo-shipped test photo so the sketch renders out of the box (no
    // S3/MinIO dependency); pick any image from the asset picker.
    image: testImagePaths[ 1 ] ?? "/assets/images/test/DSC02023%20Medium.jpeg",
    margin: 0.1,
    scale: 1.1,
    center: true,
    clip: false,
    fill: true
  },
  segmentation: {
    // Normalized (0-1) focus points fed to the interactive segmenter — one
    // mask per point, the subject is their union. Click the photo to add a
    // point, click a marker (the circle with the minus) to unpick its zone.
    points: [
      {
        x: 0.6159245171740532,
        y: 0.41899350991726275
      }
    ],
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
  trail: {
    // Normalized handles. Drag them on the canvas or edit them here.
    anchor: {
      x: 0.49990822049731387,
      y: 0.48710985538957857
    },
    guides: {
      a: {
        x: 0.3,
        y: 0.3
      },
      b: {
        x: 0.12,
        y: 0.5
      }
    }
  } as TrailHandles,
  direction: {
    // angles → launch angle + bend, no control points; spline → the two
    // draggable guide handles steer the trail (Chaikin corner-cutting).
    mode: "angles" as "angles" | "spline",
    // Launch heading in degrees: 0 = up, positive = clockwise.
    startAngle: -9,
    // Total heading change from launch to exit (degrees) — the swoosh.
    bend: -20,
    // Where the bending happens along the trail.
    easing: "easeInOutSine",
    // Trail length as a fraction of the canvas diagonal.
    length: 0.15,
    // Also stamp ghosts the other way, mirrored through the anchor.
    bidirectional: false,
    // Chaikin iterations for the spline mode.
    iterations: 4
  },
  echo: {
    // Number of ghost copies along the path.
    copies: 7,
    // Opacity of the nearest / farthest ghost.
    opacityStart: 0.74,
    opacityEnd: 0.24,
    // Size multipliers of the nearest / farthest ghost (× subject size).
    scaleStart: 0.95,
    scaleEnd: 2,
    // Extra rotation of the farthest ghost (degrees), eased along the path.
    rotate: -98,
    // Also rotate each ghost with the local path direction.
    alignToPath: false,
    // How opacity / scale / rotation / tint progress along the path.
    easing: "linear",
    // Whole march-along-the-path cycles per animation loop — 0 keeps the
    // ghosts still, integers keep the exported video seamless.
    travel: 0,
    tint: {
      // Push the ghosts toward this colour, stronger toward the tail.
      // Amount 0 leaves the photo colours untouched.
      color: [
        64,
        120,
        255
      ],
      amount: 0
    }
  },
  wave: {
    // Sideways sine offset of the path, as a fraction of the smaller
    // canvas dimension.
    amplitude: 0,
    // Number of full oscillations along the path.
    twists: 1.5,
    // Bunches the oscillations toward the start (>1) or the end (<1).
    warp: 1,
    // Whole wave cycles per animation loop — 0 keeps the path still,
    // integers keep the exported video seamless.
    speed: 0
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
    // Master switch for the on-canvas drag handles (anchor + guides).
    // Turn off for the final render / export.
    show: true,
    radius: 44,
    size: 16
  },
  marker: {
    // Focus markers double as the unpick control (click the circle with
    // the minus to remove that zone), so they show by default.
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
  segmentation: {
    label: "Segmentation",
    component: "nested-object",
    fields: {
      points: {
        label: "Focus points (click photo to add, click a marker to remove)",
        component: "item-list",
        itemConfig: {
          component: "vector2d",
          label: "Focus point",
          allowNegative: false,
          min: 0,
          max: 1,
          step: 0.01,
          yDown: true
        }
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
  trail: {
    label: "Trail handles (normalized 0..1)",
    component: "nested-object",
    fields: {
      anchor: {
        label: "Anchor (drop on the subject)",
        component: "vector2d",
        min: 0,
        max: 1,
        step: 0.001,
        yDown: true
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
        label: "Launch angle (°, 0 = up)",
        component: "slider",
        min: -180,
        max: 180,
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
        min: 0.05,
        max: 1.5,
        step: 0.05
      },
      bidirectional: {
        label: "Echo both ways",
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
  echo: {
    label: "Echo",
    component: "nested-object",
    initialExpanded: true,
    fields: {
      copies: {
        label: "Ghost copies",
        component: "slider",
        min: 1,
        max: 24,
        step: 1
      },
      opacityStart: {
        label: "Opacity at the subject",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      opacityEnd: {
        label: "Opacity at the tail",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      scaleStart: {
        label: "Scale × at the subject",
        component: "slider",
        min: 0.1,
        max: 2,
        step: 0.05
      },
      scaleEnd: {
        label: "Scale × at the tail",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      rotate: {
        label: "Rotation at the tail (°)",
        component: "slider",
        min: -360,
        max: 360,
        step: 1
      },
      alignToPath: {
        label: "Rotate with the path",
        component: "checkbox"
      },
      easing: {
        label: "Falloff easing",
        component: "easing"
      },
      travel: {
        label: "Travel (cycles per loop)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      tint: {
        label: "Tint",
        component: "nested-object",
        fields: {
          color: {
            label: "Color",
            component: "color"
          },
          amount: {
            label: "Amount at the tail",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.01
          }
        }
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
    label: "Focus markers",
    component: "nested-object",
    fields: {
      show: {
        label: "Show markers (click one to unpick its zone)",
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
