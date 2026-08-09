import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  interactionFormConfiguration, interactionFormValues
} from "@/p5/utils/interaction/defaults.js";
import {
  dragClickFormConfiguration, dragClickFormValues
} from "@/p5/utils/interaction/dragClickOptions.js";

// A cycle of texts (single letters or whole words) converted into one another
// by a troupe of virtual pointers — but unlike v8's chauffeured drags, each
// cursor grabs a point and stretches it like an elastic: by default the drag
// goes all the way to the canvas edge, opposite the point's next destination
// (flick.pullMode; "opposite" pulls a fixed distance instead), and on release
// the point flies to its position in the next text on its own, landing with
// an elastic spring (the flick easing) — the next text is revealed by
// ricochet while the cursors are already plucking further points. Missing points are
// thrown in from outside the canvas (add-pointer icon), surplus points are
// flicked off-canvas (remove-pointer icon). Each finished text holds legible
// for a fraction of its beat; cursors between jobs wait as a spinning beach
// ball. The whole show lives on the loop clock, so frame 0 (first text
// formed, no cursors) wraps seamlessly — live and in a deterministic capture.
export const formValues = {
  timeScale: 1,

  text: {
    words: [
      "x",
      "y",
      "z"
    ] as string[],
    font: "agiro",
    detail: 1,
    simplify: 0,
    // Points sampled along each text's outlines (split proportionally to
    // contour perimeter, ≥ 3 per ring).
    handles: 28,
    // Baseline-to-baseline distance between the lines of a multi-line entry,
    // in font-size units (vertical reels layouts).
    lineSpacing: 1.15
  },

  material: {
    size: 1.55,
    thickness: 0.03,
    fusion: 0.064
  },

  morph: {
    // Fraction of each beat the finished text stays legible before the troupe
    // starts converting it into the next one.
    hold: 0.3
  },

  grab: {
    // Pick-up radius (px) around a handle: a press/touch/pinch within it grabs it.
    radius: 49,
    // Camera pinch: the finger tips must be closer than this (px) to count as
    // "pressed". Released at 1.6× this (hysteresis). Shared by both gestures.
    pinch: 70,
    // EMA lag on the pinch midpoint to calm jittery hand landmarks (0 = none,
    // higher = smoother but laggier). Mouse / touch stay unsmoothed.
    cameraSmoothing: 0.4,
    // Depth gesture gain (negative inverts push/pull).
    depthGain: 1
  },

  // Mouse + touch + camera hands can still sculpt mid-show. Touch MUST stay
  // enabled so the viewport hands the touchscreen to the sketch instead of
  // panning. Vision is armed (Hands pre-selected for the pinches) but starts
  // OFF — flip Vision → Enabled to sculpt by pinching.
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
      hands: {
        ...interactionFormValues.vision.hands,
        enabled: false,
        maxHands: 2,
        landmarks: {
          fingertips: true,
          palm: false
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
    },
    // The stage crew: cursors that flick each text into the next. One artwork
    // per pointer state (same `image` asset field as the photo sketches); the
    // timing values are WEIGHTS shaping the rhythm inside each task's slice
    // of the conversion window — the window itself is set by the beat layout,
    // so the show always completes and the loop always closes. The flick
    // group shapes the throw itself: pull-back distance, flight time, and the
    // easing the point lands with (elastic by default).
    virtualPointers: {
      enabled: true,
      images: {
        pointing: "/assets/images/cursors/handpointing.png",
        open: "/assets/images/cursors/handopen.png",
        grabbing: "/assets/images/cursors/handgrabbing.png",
        add: "/assets/images/cursors/addpointer.png",
        remove: "/assets/images/cursors/removepointer.png",
        waiting: "/assets/images/cursors/beachball.png"
      },
      // Drawn size, normalized: × the artwork's natural resolution (the
      // shipped images are 256 px, so 0.18 ≈ 46 px on screen).
      scale: 0.4,
      count: 8,
      seed: 7,
      easing: "easeInOutCubic",
      timing: {
        stagger: 0.2,
        travel: 0.45,
        hover: 0.15,
        pull: 0.45,
        release: 0.2,
        fade: 0.35
      },
      flick: {
        pullMode: "edge",
        pull: 36,
        flightTime: 0.9,
        easing: "easeOutElastic"
      },
      // Cursors caught between jobs (a hold beat, or waiting for their next
      // window): where they wait is the mode — "stay" on their release spot,
      // "aside" at a random spot along the canvas border (still visible, the
      // finished text breathes), or "exit" off-canvas entirely (they fade out
      // and re-enter like the entrance/exodus). The beach ball spins wherever
      // they wait visibly.
      idle: {
        mode: "aside",
        beachball: true,
        spinSpeed: 1.95
      }
    }
  },

  // The sound of the show: a click for the button going down (a pointer
  // grabbing a point) and another for it coming back up (the release of the
  // throw). Both ship with the app — drop your own audio file on either field
  // to replace it. Sounds are triggered through the sketch audio engine, so
  // they are heard live, mixed into a browser recording, and rendered
  // sample-accurately into a server capture.
  sound: {
    ...dragClickFormValues
  },

  // The usual hand-capture look for detected hands: a glowing spline through
  // the fingertips, plus the per-hand pinch markers (always on).
  hands: {
    show: false,
    weight: 14,
    glow: 2,
    iterations: 5,
    hueSpeed: 1.5,
    hueSpread: 2
  },

  camera: {
    fov: 30,
    distance: 11.8,
    // Auto-fit eases the distance from each text's fitted framing to the
    // next's during the conversion — words and letters mix freely. The zoom
    // rides the easing curve, so it coasts into each framing instead of
    // stopping dead (a Back ease adds a touch of overshoot).
    autoFit: {
      enabled: true,
      margin: 0.15,
      easing: "easeInOutCubic"
    },
    phase: 0.3,
    elevation: 0.2,
    orbit: 0,
    sway: 0.04,
    swayCycles: 1,
    fogDensity: 0.06
  },

  colors: {
    hueSpeed: -0.12,
    hueSpread: 4.03,
    huePhase: 2.6,
    lengthHueShift: -0.25,
    pipeHueShift: 0.6,
    shimmer: 2.2,
    saturation: 0.9,
    brightness: 1.25
  },

  light: {
    azimuth: -1.1,
    elevation: 0.45,
    ambient: 0.3,
    diffuse: 0.75,
    specular: 1.1,
    specPower: 42,
    fresnelPower: 2.2,
    rimStrength: 0,
    shadowSoftness: 0
  },

  rendering: {
    resolutionScale: 1
  },

  overlay: {
    points: {
      show: true,
      size: 14,
      coreRatio: 0.5,
      color: [
        255,
        255,
        255,
        255
      ] as number[],
      coreColor: [
        10,
        10,
        14,
        255
      ] as number[]
    }
  },

  backgroundColor: [
    0,
    0,
    0
  ] as number[]
};

export const formConfiguration: Record<string, any> = {
  timeScale: {
    label: "Time scale",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.01
  },

  text: {
    component: "nested-object",
    label: "Texts",
    fields: {
      words: {
        label: "Cycle (one beat each — line breaks make stacked blocks)",
        component: "item-list",
        minItems: 1,
        maxItems: 8,
        itemConfig: {
          label: "Text",
          component: "textarea"
        }
      },
      font: {
        label: "Font",
        component: "select",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      detail: {
        label: "Outline detail (sample factor)",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.01
      },
      simplify: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.05
      },
      handles: {
        label: "Points per text",
        component: "slider",
        min: 12,
        max: 64,
        step: 1
      },
      lineSpacing: {
        label: "Line spacing (× font size)",
        component: "slider",
        min: 0.6,
        max: 2,
        step: 0.05
      }
    }
  },

  material: {
    component: "nested-object",
    label: "Material (tube)",
    fields: {
      size: {
        label: "Text size (world)",
        component: "slider",
        min: 0.5,
        max: 5,
        step: 0.05
      },
      thickness: {
        label: "Tube thickness",
        component: "slider",
        min: 0.005,
        max: 0.35,
        step: 0.005
      },
      fusion: {
        label: "Junction fusion (smooth-union fillet)",
        component: "slider",
        min: 0.001,
        max: 0.25,
        step: 0.001
      }
    }
  },

  morph: {
    component: "nested-object",
    label: "Cycle",
    fields: {
      hold: {
        label: "Hold (fraction of each beat the text stays legible)",
        component: "slider",
        min: 0,
        max: 0.85,
        step: 0.01
      }
    }
  },

  grab: {
    label: "Grab (manual sculpting)",
    component: "nested-object",
    fields: {
      radius: {
        label: "Pick-up radius (px)",
        component: "slider",
        min: 10,
        max: 120,
        step: 1
      },
      pinch: {
        label: "Camera pinch distance (px)",
        component: "slider",
        min: 20,
        max: 200,
        step: 1
      },
      cameraSmoothing: {
        label: "Camera smoothing",
        component: "slider",
        min: 0,
        max: 0.95,
        step: 0.05
      },
      depthGain: {
        label: "Depth gesture gain (negative inverts)",
        component: "slider",
        min: -4,
        max: 4,
        step: 0.1
      }
    }
  },

  // Focused subset of the shared interaction form: only the modalities this
  // sketch reads (mouse, touch, camera hands) plus the stage crew.
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
          ...interactionFormConfiguration.fields.vision.fields,
          hands: {
            ...interactionFormConfiguration.fields.vision.fields.hands,
            fields: {
              ...interactionFormConfiguration.fields.vision.fields.hands.fields,
              maxHands: {
                component: "slider",
                label: "Max hands",
                min: 1,
                max: 10,
                step: 1
              }
            }
          }
        }
      },
      virtualPointers: {
        component: "nested-object",
        label: "Virtual pointers",
        fields: {
          enabled: {
            label: "Enabled (run the conversion show)",
            component: "checkbox"
          },
          images: {
            component: "nested-object",
            label: "Images",
            fields: {
              pointing: {
                label: "Default pointer",
                component: "image"
              },
              open: {
                label: "Open hand (over a point)",
                component: "image"
              },
              grabbing: {
                label: "Closed hand (pulling a point back)",
                component: "image"
              },
              add: {
                label: "Add pointer (throwing a new point in)",
                component: "image"
              },
              remove: {
                label: "Remove pointer (flicking a point away)",
                component: "image"
              },
              waiting: {
                label: "Waiting (spins between jobs)",
                component: "image"
              }
            }
          },
          scale: {
            label: "Image scale (× natural size)",
            component: "slider",
            min: 0.02,
            max: 1,
            step: 0.01
          },
          count: {
            label: "Cursors (tasks are split between them)",
            component: "slider",
            min: 1,
            max: 16,
            step: 1
          },
          seed: {
            label: "Random seed",
            component: "slider",
            min: 0,
            max: 100,
            step: 1
          },
          easing: {
            label: "Cursor movement easing",
            component: "easing"
          },
          timing: {
            component: "nested-object",
            label: "Rhythm (weights within each task)",
            fields: {
              stagger: {
                label: "Start stagger between cursors",
                component: "slider",
                min: 0,
                max: 2,
                step: 0.05
              },
              travel: {
                label: "Travel weight",
                component: "slider",
                min: 0.05,
                max: 3,
                step: 0.05
              },
              hover: {
                label: "Hover weight (pause before grabbing)",
                component: "slider",
                min: 0,
                max: 2,
                step: 0.05
              },
              pull: {
                label: "Pull weight (drawing the sling back)",
                component: "slider",
                min: 0.05,
                max: 3,
                step: 0.05
              },
              release: {
                label: "Release weight (watching the throw)",
                component: "slider",
                min: 0,
                max: 2,
                step: 0.05
              },
              fade: {
                label: "Fade in/out duration (loop seconds)",
                component: "slider",
                min: 0,
                max: 2,
                step: 0.05
              }
            }
          },
          flick: {
            component: "nested-object",
            label: "Flick (the throw)",
            fields: {
              pullMode: {
                label: "Elastic draw",
                component: "select",
                options: [
                  {
                    value: "edge",
                    label: "Stretch to the canvas edge (opposite the landing spot)"
                  },
                  {
                    value: "opposite",
                    label: "Pull back a fixed distance (opposite the landing spot)"
                  }
                ]
              },
              pull: {
                label: "Pull-back distance (px, fixed-distance mode)",
                component: "slider",
                min: 0,
                max: 150,
                step: 1
              },
              flightTime: {
                label: "Flight time (loop seconds, clamped to the beat)",
                component: "slider",
                min: 0.05,
                max: 3,
                step: 0.05
              },
              easing: {
                label: "Landing easing (how the point snaps into place)",
                component: "easing"
              }
            }
          },
          idle: {
            component: "nested-object",
            label: "Waiting",
            fields: {
              mode: {
                label: "Between jobs",
                component: "select",
                options: [
                  {
                    value: "stay",
                    label: "Stay on the release spot"
                  },
                  {
                    value: "aside",
                    label: "Step aside to the canvas edge"
                  },
                  {
                    value: "exit",
                    label: "Leave the canvas, re-enter for the next job"
                  }
                ]
              },
              beachball: {
                label: "Spin the waiting icon between jobs",
                component: "checkbox"
              },
              spinSpeed: {
                label: "Spin speed (turns per loop second)",
                component: "slider",
                min: 0,
                max: 4,
                step: 0.05
              }
            }
          }
        }
      }
    }
  },

  sound: dragClickFormConfiguration,

  hands: {
    label: "Hand visuals",
    component: "nested-object",
    fields: {
      show: {
        label: "Show hand ribbons",
        component: "checkbox"
      },
      weight: {
        label: "Ribbon weight",
        component: "slider",
        min: 2,
        max: 40,
        step: 0.5
      },
      glow: {
        label: "Glow layers",
        component: "slider",
        min: 0,
        max: 8,
        step: 1
      },
      iterations: {
        label: "Chaikin iterations",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: 0,
        max: 5,
        step: 0.1
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.05
      }
    }
  },

  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 30,
        max: 110,
        step: 1
      },
      distance: {
        label: "Distance (used when auto-fit is off)",
        component: "slider",
        min: 0.5,
        max: 20,
        step: 0.05
      },
      autoFit: {
        component: "nested-object",
        label: "Auto-fit",
        fields: {
          enabled: {
            label: "Fit the distance to each text's width",
            component: "checkbox"
          },
          margin: {
            label: "Fit margin",
            component: "slider",
            min: 0,
            max: 1.5,
            step: 0.05
          },
          easing: {
            label: "Zoom easing (how the framing settles)",
            component: "easing"
          }
        }
      },
      phase: {
        label: "Yaw (viewpoint angle)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      elevation: {
        label: "Elevation (look down ↔ up at the text)",
        component: "slider",
        min: -1.4,
        max: 1.4,
        step: 0.01
      },
      orbit: {
        label: "Orbit turns per loop (0 = static camera)",
        component: "slider",
        min: -4,
        max: 4,
        step: 1
      },
      sway: {
        label: "Vertical sway amplitude (pitch)",
        component: "slider",
        min: 0,
        max: 0.8,
        step: 0.01
      },
      swayCycles: {
        label: "Vertical sway cycles per loop",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      fogDensity: {
        label: "Fog density (depth cue on pushed points)",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.005
      }
    }
  },

  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      hueSpeed: {
        label: "Hue speed (snaps to whole cycles/loop)",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0.1,
        max: 6,
        step: 0.01
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      lengthHueShift: {
        label: "Height hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      pipeHueShift: {
        label: "Outline hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      shimmer: {
        label: "Shimmer (oil-slick)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },

  light: {
    component: "nested-object",
    label: "Lighting",
    fields: {
      azimuth: {
        label: "Light azimuth",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      elevation: {
        label: "Light elevation",
        component: "slider",
        min: -1.5708,
        max: 1.5708,
        step: 0.01
      },
      ambient: {
        label: "Ambient",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      diffuse: {
        label: "Diffuse",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      specular: {
        label: "Specular",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      specPower: {
        label: "Specular sharpness",
        component: "slider",
        min: 1,
        max: 128,
        step: 1
      },
      fresnelPower: {
        label: "Fresnel power",
        component: "slider",
        min: 0.5,
        max: 6,
        step: 0.01
      },
      rimStrength: {
        label: "Rim glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      shadowSoftness: {
        label: "Text shadows (0 = off, higher = harder)",
        component: "slider",
        min: 0,
        max: 64,
        step: 1
      }
    }
  },

  rendering: {
    component: "nested-object",
    label: "Rendering",
    fields: {
      resolutionScale: {
        label: "Resolution scale (perf ↔ quality)",
        component: "slider",
        min: 0.25,
        max: 1,
        step: 0.05
      }
    }
  },

  overlay: {
    label: "Point markers",
    component: "nested-object",
    fields: {
      points: {
        label: "Points",
        component: "nested-object",
        fields: {
          show: {
            label: "Show points",
            component: "checkbox"
          },
          size: {
            label: "Size (diameter)",
            component: "slider",
            min: 0,
            max: 60,
            step: 0.5
          },
          coreRatio: {
            label: "Inner core ratio",
            component: "slider",
            min: 0,
            max: 1,
            step: 0.02
          },
          color: {
            label: "Color",
            component: "color"
          },
          coreColor: {
            label: "Inner core color",
            component: "color"
          }
        }
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
