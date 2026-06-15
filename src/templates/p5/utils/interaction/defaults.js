// ── Default form values for the shared interaction block ──────────────────
// Import into any sketch's options.ts and spread/override as needed:
//   import { interactionFormValues, interactionFormConfiguration }
//     from "@/p5/utils/interaction/defaults.js";

export const interactionFormValues = {
  enabled: true,

  mouse: {
    enabled: false,
    smoothing: 0,
    offset: {
      x: 0,
      y: 0
    }
  },

  touch: {
    enabled: false,
    maxTouches: 5
  },

  vision: {
    enabled: false,
    // What inference runs on. mode "webcam" uses the camera (deviceId picks
    // one of several attached cameras); mode "video" / "image" runs the same
    // trackers on a video or image asset instead — no webcam involved.
    source: {
      mode: "webcam",
      deviceId: "",
      width: 320,
      height: 240,
      flip: true,
      showPreview: false
    },
    hands: {
      enabled: false,
      maxHands: 2,
      landmarks: {
        fingertips: true,
        palm: false
      },
      confidence: 0.5,
      drawOverlay: false
    },
    fingers: {
      enabled: false,
      maxHands: 2,
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true
    },
    face: {
      enabled: false,
      maxFaces: 1,
      confidence: 0.5,
      drawOverlay: false
    },
    body: {
      enabled: false,
      maxPoses: 1,
      model: "lite",
      landmarks: {
        wrists: true,
        elbows: false,
        shoulders: false,
        hips: false
      },
      confidence: 0.3,
      drawOverlay: false
    },
    performance: {
      useWorker: true,
      inferenceInterval: 20,
      idleInterval: 280,
      idleAfter: 3000
    }
  },

  orbit: {
    enabled: true,
    count: 1,
    margin: 150,
    speed: 1,
    sinAngleMultiplier: 2,
    cosAngleMultiplier: 1,
    sinProgressionMultiplier: 1,
    cosProgressionMultiplier: 4
  },

  perlinNoise: {
    enabled: false,
    count: 3,
    speed: 0.005,
    margin: 50,
    seed: 0
  },

  gyroscope: {
    enabled: false,
    clampAngle: 45,
    offset: {
      x: 0,
      y: 0
    }
  },

  midi: {
    enabled: false,
    maxNotes: 10
  },

  audio: {
    enabled: false,
    count: 1,
    smoothing: 0.8,
    fftSize: 1024,
    margin: 50
  },

  joypad: {
    enabled: false,
    count: 1,
    deadzone: 0.1
  },

  visualization: {
    enabled: true,
    showImages: false,
    showLines: true,
    showPointers: true,
    showLegend: true,
    linesStroke: [
      200,
      200,
      200
    ],
    linesStrokeWeight: 1
  }
};

// ── Form configuration fragment ────────────────────────────────────────────
// Use as:  formConfiguration = { interaction: interactionFormConfiguration, ... }

export const interactionFormConfiguration = {
  component: "nested-object",
  label: "Interaction",
  fields: {
    enabled: {
      component: "checkbox",
      label: "Enabled"
    },

    mouse: {
      component: "nested-object",
      label: "Mouse",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        smoothing: {
          component: "slider",
          label: "Smoothing",
          min: 0,
          max: 0.99,
          step: 0.01
        },
        offset: {
          component: "vector2d",
          label: "Offset",
          min: -500,
          max: 500,
          step: 1,
          yDown: true
        }
      }
    },

    touch: {
      component: "nested-object",
      label: "Touch",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        maxTouches: {
          component: "slider",
          label: "Max touches",
          min: 1,
          max: 10,
          step: 1
        }
      }
    },

    vision: {
      component: "nested-object",
      label: "Vision (Camera)",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },

        source: {
          component: "conditional-group",
          label: "Source",
          conditionalOn: "mode",
          hideNone: true,
          typeSelector: {
            label: "Source",
            options: [
              {
                label: "Webcam",
                value: "webcam"
              },
              {
                label: "Video asset",
                value: "video"
              },
              {
                label: "Image asset",
                value: "image"
              }
            ]
          },
          configs: {
            webcam: {
              deviceId: {
                component: "webcam-device-select",
                label: "Camera"
              },
              width: {
                component: "select",
                label: "Width",
                asNumber: true,
                options: [
                  {
                    label: "320",
                    value: "320"
                  },
                  {
                    label: "640",
                    value: "640"
                  },
                  {
                    label: "1280",
                    value: "1280"
                  }
                ]
              },
              height: {
                component: "select",
                label: "Height",
                asNumber: true,
                options: [
                  {
                    label: "240",
                    value: "240"
                  },
                  {
                    label: "480",
                    value: "480"
                  },
                  {
                    label: "720",
                    value: "720"
                  }
                ]
              },
              flip: {
                component: "checkbox",
                label: "Flip (mirror)",
                default: true
              },
              showPreview: {
                component: "checkbox",
                label: "Show preview"
              }
            },
            video: {
              videos: {
                component: "asset-stack",
                kind: "videos",
                label: "Video (first one drives inference)"
              },
              flip: {
                component: "checkbox",
                label: "Flip (mirror)"
              },
              showPreview: {
                component: "checkbox",
                label: "Show preview"
              }
            },
            image: {
              image: {
                component: "image",
                label: "Image"
              },
              flip: {
                component: "checkbox",
                label: "Flip (mirror)"
              },
              showPreview: {
                component: "checkbox",
                label: "Show preview"
              }
            }
          }
        },

        hands: {
          component: "nested-object",
          label: "Hands",
          fields: {
            enabled: {
              component: "checkbox",
              label: "Enabled"
            },
            maxHands: {
              component: "slider",
              label: "Max hands",
              min: 1,
              max: 2,
              step: 1
            },
            landmarks: {
              component: "nested-object",
              label: "Landmarks",
              fields: {
                fingertips: {
                  component: "checkbox",
                  label: "Fingertips (×5 per hand)"
                },
                palm: {
                  component: "checkbox",
                  label: "Palm center"
                }
              }
            },
            confidence: {
              component: "slider",
              label: "Min confidence",
              min: 0.1,
              max: 0.9,
              step: 0.05
            },
            drawOverlay: {
              component: "checkbox",
              label: "Draw skeleton"
            }
          }
        },

        fingers: {
          component: "nested-object",
          label: "Fingers (per-finger joint chains)",
          fields: {
            enabled: {
              component: "checkbox",
              label: "Enabled"
            },
            maxHands: {
              component: "slider",
              label: "Max hands",
              min: 1,
              max: 2,
              step: 1
            },
            thumb: {
              component: "checkbox",
              label: "Thumb"
            },
            index: {
              component: "checkbox",
              label: "Index"
            },
            middle: {
              component: "checkbox",
              label: "Middle"
            },
            ring: {
              component: "checkbox",
              label: "Ring"
            },
            pinky: {
              component: "checkbox",
              label: "Pinky"
            }
          }
        },

        face: {
          component: "nested-object",
          label: "Face",
          fields: {
            enabled: {
              component: "checkbox",
              label: "Enabled"
            },
            maxFaces: {
              component: "slider",
              label: "Max faces",
              min: 1,
              max: 4,
              step: 1
            },
            confidence: {
              component: "slider",
              label: "Min confidence",
              min: 0.1,
              max: 0.9,
              step: 0.05
            },
            drawOverlay: {
              component: "checkbox",
              label: "Draw bounding box"
            }
          }
        },

        body: {
          component: "nested-object",
          label: "Body",
          fields: {
            enabled: {
              component: "checkbox",
              label: "Enabled"
            },
            maxPoses: {
              component: "slider",
              label: "Max poses",
              min: 1,
              max: 2,
              step: 1
            },
            model: {
              component: "select",
              label: "Model",
              options: [
                {
                  label: "Lite (fast)",
                  value: "lite"
                },
                {
                  label: "Heavy (accurate)",
                  value: "heavy"
                }
              ]
            },
            landmarks: {
              component: "nested-object",
              label: "Landmarks",
              fields: {
                wrists: {
                  component: "checkbox",
                  label: "Wrists"
                },
                elbows: {
                  component: "checkbox",
                  label: "Elbows"
                },
                shoulders: {
                  component: "checkbox",
                  label: "Shoulders"
                },
                hips: {
                  component: "checkbox",
                  label: "Hips"
                }
              }
            },
            confidence: {
              component: "slider",
              label: "Min confidence",
              min: 0.1,
              max: 0.9,
              step: 0.05
            },
            drawOverlay: {
              component: "checkbox",
              label: "Draw skeleton"
            }
          }
        },

        performance: {
          component: "nested-object",
          label: "Performance",
          fields: {
            useWorker: {
              component: "checkbox",
              label: "Run inference in a worker"
            },
            inferenceInterval: {
              component: "slider",
              label: "Inference interval (ms)",
              min: 10,
              max: 200,
              step: 5
            },
            idleInterval: {
              component: "slider",
              label: "Idle interval (ms)",
              min: 50,
              max: 1000,
              step: 10
            },
            idleAfter: {
              component: "slider",
              label: "Idle after (ms)",
              min: 500,
              max: 10000,
              step: 100
            }
          }
        }
      }
    },

    orbit: {
      component: "nested-object",
      label: "Orbit (virtual)",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        count: {
          component: "slider",
          label: "Count",
          min: 0,
          max: 24,
          step: 1
        },
        margin: {
          component: "slider",
          label: "Margin",
          min: 0,
          max: 500,
          step: 1
        },
        speed: {
          component: "slider",
          label: "Speed",
          min: 0.1,
          max: 5,
          step: 0.1
        },
        sinAngleMultiplier: {
          component: "slider",
          label: "Sin angle ×",
          min: 0.1,
          max: 10,
          step: 0.1
        },
        cosAngleMultiplier: {
          component: "slider",
          label: "Cos angle ×",
          min: 0.1,
          max: 10,
          step: 0.1
        },
        sinProgressionMultiplier: {
          component: "slider",
          label: "Sin phase ×",
          min: 0.1,
          max: 10,
          step: 0.1
        },
        cosProgressionMultiplier: {
          component: "slider",
          label: "Cos phase ×",
          min: 0.1,
          max: 10,
          step: 0.1
        }
      }
    },

    perlinNoise: {
      component: "nested-object",
      label: "Perlin Noise (virtual)",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        count: {
          component: "slider",
          label: "Count",
          min: 1,
          max: 20,
          step: 1
        },
        speed: {
          component: "slider",
          label: "Speed",
          min: 0.001,
          max: 0.05,
          step: 0.001
        },
        margin: {
          component: "slider",
          label: "Margin",
          min: 0,
          max: 500,
          step: 1
        },
        seed: {
          component: "slider",
          label: "Seed",
          min: 0,
          max: 9999,
          step: 1
        }
      }
    },

    gyroscope: {
      component: "nested-object",
      label: "Gyroscope",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        clampAngle: {
          component: "slider",
          label: "Clamp angle (°)",
          min: 5,
          max: 90,
          step: 5
        },
        offset: {
          component: "vector2d",
          label: "Offset",
          min: -500,
          max: 500,
          step: 1,
          yDown: true
        }
      }
    },

    midi: {
      component: "nested-object",
      label: "MIDI",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        maxNotes: {
          component: "slider",
          label: "Max simultaneous notes",
          min: 1,
          max: 32,
          step: 1
        }
      }
    },

    audio: {
      component: "nested-object",
      label: "Audio (Microphone)",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        count: {
          component: "slider",
          label: "Frequency bands",
          min: 1,
          max: 16,
          step: 1
        },
        smoothing: {
          component: "slider",
          label: "Smoothing",
          min: 0,
          max: 0.99,
          step: 0.01
        },
        fftSize: {
          component: "select",
          label: "FFT size",
          asNumber: true,
          options: [
            {
              label: "512",
              value: "512"
            },
            {
              label: "1024",
              value: "1024"
            },
            {
              label: "2048",
              value: "2048"
            }
          ]
        },
        margin: {
          component: "slider",
          label: "Margin",
          min: 0,
          max: 300,
          step: 1
        }
      }
    },

    joypad: {
      component: "nested-object",
      label: "Joypad / Gamepad",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        count: {
          component: "slider",
          label: "Max gamepads",
          min: 1,
          max: 4,
          step: 1
        },
        deadzone: {
          component: "slider",
          label: "Deadzone",
          min: 0,
          max: 0.5,
          step: 0.01
        }
      }
    },

    visualization: {
      component: "nested-object",
      label: "Visualization",
      fields: {
        enabled: {
          component: "checkbox",
          label: "Enabled"
        },
        showImages: {
          component: "checkbox",
          label: "Show pointer images"
        },
        showLines: {
          component: "checkbox",
          label: "Show crosshair lines"
        },
        showPointers: {
          component: "checkbox",
          label: "Show pointer markers"
        },
        showLegend: {
          component: "checkbox",
          label: "Show source legend"
        },
        linesStroke: {
          component: "color",
          label: "Lines color"
        },
        linesStrokeWeight: {
          component: "slider",
          label: "Lines weight",
          min: 0.5,
          max: 10,
          step: 0.5
        }
      }
    }
  }
};
