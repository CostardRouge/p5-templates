import {
  interactionFormConfiguration, interactionFormValues
} from "@/p5/utils/interaction/defaults.js";

// The hand-clip studio: a sandbox that records your own hand on camera into
// portable `p5t-handclip` takes (see `shared/handClips/README.md`). A
// prompter shows the gesture to perform and two draggable targets A and B;
// a countdown starts the take, the raw landmarks are baked (smoothed,
// resampled to a uniform fps, pinch phases detected) and reviewed on a
// scrubbable timeline where the close/open markers can be nudged; then the
// clip is exported — downloaded, or in dev written straight into the shared
// clip library. Real-time tool: not meant for deterministic capture.
export const formValues = {
  clip: {
    // Base name of exported clips; each kept take gets a running number.
    name: "pinch-drag",
    // Comma-separated tags stored in the clip.
    tags: "pinch, drag",
    // Which tracked hand to record: the first seen, or a MediaPipe
    // handedness label. Note MediaPipe labels the MIRRORED image, so with a
    // flipped webcam "Right" is your right hand as you see it on screen.
    hand: "any",
    // landmarks-21 stores the full hand (can render a skeleton); tips-6 only
    // the wrist + five fingertips (3.5× smaller, enough to pinch).
    layout: "landmarks-21"
  },

  prompter: {
    scenarios: [
      "Hover over A with an open hand, pinch it, carry it to B, let go, leave the frame.",
      "Come in from below, pinch A, swing it to B in a wide arc, release with a flick.",
      "Pinch A, hold still for a second, drag slowly to B, open the hand and rest."
    ] as string[],
    // Targets, normalized to the canvas (draggable on canvas too).
    a: {
      x: 0.3,
      y: 0.5
    },
    b: {
      x: 0.7,
      y: 0.5
    }
  },

  record: {
    // Seconds between pressing R and the take starting.
    countdown: 3,
    // Takes stop by themselves after this many seconds.
    maxSeconds: 8
  },

  bake: {
    fps: 60,
    // One-Euro smoothing: lower cutoff = calmer slow motion; beta = how
    // quickly fast motion escapes the smoothing. Zero-phase runs the filter
    // forward and backward so peaks stay where the hand put them.
    minCutoff: 1.2,
    beta: 0.02,
    zeroPhase: true
  },

  review: {
    speed: 1,
    loop: true
  },

  calibration: {
    // The pinch threshold (px) and release ratio of the sketches the clip
    // will drive — the studio reports which playback hand scale keeps the
    // recorded pinch on the right side of them.
    pinchPx: 70,
    releaseRatio: 1.6
  },

  look: {
    cameraOpacity: 0.55,
    accent: [
      120,
      200,
      255
    ] as number[]
  },

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
      enabled: true,
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: true,
        maxHands: 2,
        landmarks: {
          fingertips: true,
          palm: true
        }
      }
    },
    orbit: {
      ...interactionFormValues.orbit,
      enabled: false
    },
    visualization: {
      ...interactionFormValues.visualization,
      enabled: false
    }
  }
};

export const formConfiguration: Record<string, any> = {
  clip: {
    component: "nested-object",
    label: "Clip",
    fields: {
      name: {
        label: "Name (exports are numbered from it)",
        component: "text"
      },
      tags: {
        label: "Tags (comma-separated)",
        component: "text"
      },
      hand: {
        label: "Hand to record",
        component: "select",
        options: [
          {
            label: "First tracked hand",
            value: "any"
          },
          {
            label: "Left (as MediaPipe labels it)",
            value: "Left"
          },
          {
            label: "Right (as MediaPipe labels it)",
            value: "Right"
          }
        ]
      },
      layout: {
        label: "Point layout",
        component: "select",
        options: [
          {
            label: "Full hand — 21 landmarks",
            value: "landmarks-21"
          },
          {
            label: "Compact — wrist + 5 fingertips",
            value: "tips-6"
          }
        ]
      }
    }
  },

  prompter: {
    component: "nested-object",
    label: "Prompter",
    fields: {
      scenarios: {
        label: "Scenarios (keys 1–9 select one)",
        component: "item-list",
        minItems: 1,
        maxItems: 9,
        itemConfig: {
          label: "Instruction",
          component: "textarea"
        }
      },
      a: {
        component: "vector2d",
        label: "Target A (grab here)",
        allowNegative: false,
        min: 0,
        max: 1,
        step: 0.01,
        yDown: true
      },
      b: {
        component: "vector2d",
        label: "Target B (release here)",
        allowNegative: false,
        min: 0,
        max: 1,
        step: 0.01,
        yDown: true
      }
    }
  },

  record: {
    component: "nested-object",
    label: "Recording",
    fields: {
      countdown: {
        label: "Countdown (s)",
        component: "slider",
        min: 0,
        max: 10,
        step: 1
      },
      maxSeconds: {
        label: "Max take length (s)",
        component: "slider",
        min: 1,
        max: 30,
        step: 1
      }
    }
  },

  bake: {
    component: "nested-object",
    label: "Bake",
    fields: {
      fps: {
        label: "Frame rate",
        component: "slider",
        min: 24,
        max: 120,
        step: 1
      },
      minCutoff: {
        label: "Smoothing — min cutoff (Hz)",
        component: "slider",
        min: 0.1,
        max: 5,
        step: 0.05
      },
      beta: {
        label: "Smoothing — speed coefficient",
        component: "slider",
        min: 0,
        max: 0.2,
        step: 0.005
      },
      zeroPhase: {
        label: "Zero-phase (forward + backward pass)",
        component: "checkbox"
      }
    }
  },

  review: {
    component: "nested-object",
    label: "Review",
    fields: {
      speed: {
        label: "Playback speed",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      },
      loop: {
        label: "Loop",
        component: "checkbox"
      }
    }
  },

  calibration: {
    component: "nested-object",
    label: "Calibration target",
    fields: {
      pinchPx: {
        label: "Pinch threshold of the target sketch (px)",
        component: "slider",
        min: 10,
        max: 200,
        step: 1
      },
      releaseRatio: {
        label: "Release ratio",
        component: "slider",
        min: 1,
        max: 3,
        step: 0.05
      }
    }
  },

  look: {
    component: "nested-object",
    label: "Look",
    fields: {
      cameraOpacity: {
        label: "Camera opacity",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      accent: {
        label: "Accent colour",
        component: "color"
      }
    }
  },

  // Focused subset of the shared interaction form: mouse + touch (dragging
  // the targets) and the camera hands the recorder reads.
  interaction: {
    component: "nested-object",
    label: "Input sources",
    fields: {
      enabled: interactionFormConfiguration.fields.enabled,
      mouse: interactionFormConfiguration.fields.mouse,
      touch: interactionFormConfiguration.fields.touch,
      vision: {
        ...interactionFormConfiguration.fields.vision,
        fields: {
          enabled: interactionFormConfiguration.fields.vision.fields.enabled,
          source: interactionFormConfiguration.fields.vision.fields.source,
          hands: interactionFormConfiguration.fields.vision.fields.hands,
          performance: interactionFormConfiguration.fields.vision.fields.performance
        }
      }
    }
  }
};
