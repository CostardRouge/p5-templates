import {
  webcamSourceFormConfiguration,
  webcamSourceFormValues
} from "@/p5/utils/webcam/defaults.js";

// video-reveal — the live webcam hides under a grid of opaque "hidden" cells
// (black by default). MediaPipe hand-tracking turns your fingers / hands into a
// brush: every cell a fingertip sweeps over fades IN to expose the video below,
// then fades back to black once you move away (a temporary, trailing reveal).
// The connected blob of currently-revealed cells is outlined in white on its
// OUTER edge only — internal borders between two revealed neighbours are never
// drawn, so the cluster reads as a single clean cut-out hole.

// Default values only
export const formValues = {
  // Live camera source — the shared webcam-device-select picker. MediaPipe owns
  // this single camera: it both supplies the frame we reveal AND runs the hand
  // tracking, so flip is applied by the sketch (the silhouette and the pixels
  // come from the same unflipped source and stay aligned).
  camera: {
    ...webcamSourceFormValues
  },

  // Grid layout — how the canvas is carved. Up to 64 each way.
  grid: {
    columns: 32,
    rows: 18
  },

  // How fingers paint the reveal.
  reveal: {
    // Drive the reveal from the camera hand-tracking. Off = only the demo
    // pointer (below) can wipe, useful for a webcam-free preview.
    useHands: true,
    // Use only the five fingertips (precise, scratchy) vs. every hand joint
    // (covers the whole hand, broader wipe).
    fingertipsOnly: false,
    // Cap how many detected hands contribute (1–2).
    maxHands: 2,
    // Brush size, in cells, around each tracked point — 0 reveals a single
    // cell, higher values reveal a soft disc so a swipe leaves a fat trail.
    brushRadius: 1.2,
    // Fade-in speed when a finger covers a cell (attack). Higher = snappier.
    revealSpeed: 0.4,
    // Fade-out speed when the finger leaves (release). Lower = longer trail.
    fadeSpeed: 0.08
  },

  // White cut-out outline around the revealed cluster.
  outline: {
    show: true,
    weight: 2,
    color: [
      255,
      255,
      255,
      255
    ] as number[],
    // A cell counts as "revealed" (and so contributes to the outline) once its
    // fade value passes this threshold.
    threshold: 0.18,
    // Let the outline's opacity follow each edge cell's fade value, so the
    // contour breathes in and out with the reveal instead of snapping on.
    softEdge: true
  },

  // Look of the hidden state and the revealed pixels.
  look: {
    // The colour cells show before they are revealed.
    hiddenColor: [
      0,
      0,
      0,
      255
    ] as number[],
    // Gap between cells, as a fraction of cell size (0 = seamless, 0.2 = tiles
    // separated by "grout" of the hidden colour).
    cellGap: 0,
    // Desaturate the revealed video to grayscale.
    grayscale: false
  },

  // Auto-wipe pointer(s) — a virtual hand that animates a reveal on its own, so
  // the sketch is alive (and previews / thumbnails work) without a webcam. Adds
  // to the real hands when both are on; turn off for a pure hand-controlled feel.
  demo: {
    enabled: true,
    pointers: 2,
    speed: 1
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  camera: webcamSourceFormConfiguration,

  grid: {
    component: "nested-object",
    label: "Grid",
    initialExpanded: true,
    fields: {
      columns: {
        component: "slider",
        label: "Columns",
        min: 1,
        max: 64,
        step: 1
      },
      rows: {
        component: "slider",
        label: "Rows",
        min: 1,
        max: 64,
        step: 1
      }
    }
  },

  reveal: {
    component: "nested-object",
    label: "Reveal",
    initialExpanded: true,
    fields: {
      useHands: {
        component: "checkbox",
        label: "Track hands (camera)"
      },
      fingertipsOnly: {
        component: "checkbox",
        label: "Fingertips only"
      },
      maxHands: {
        component: "slider",
        label: "Max hands",
        min: 1,
        max: 2,
        step: 1
      },
      brushRadius: {
        component: "slider",
        label: "Brush radius (cells)",
        min: 0,
        max: 6,
        step: 0.1
      },
      revealSpeed: {
        component: "slider",
        label: "Reveal speed (in)",
        min: 0.02,
        max: 1,
        step: 0.01
      },
      fadeSpeed: {
        component: "slider",
        label: "Fade speed (out)",
        min: 0.01,
        max: 1,
        step: 0.01
      }
    }
  },

  outline: {
    component: "nested-object",
    label: "Outline",
    fields: {
      show: {
        component: "checkbox",
        label: "Show outline"
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 0.5,
        max: 12,
        step: 0.5
      },
      color: {
        component: "color",
        label: "Color"
      },
      threshold: {
        component: "slider",
        label: "Reveal threshold",
        min: 0.01,
        max: 0.9,
        step: 0.01
      },
      softEdge: {
        component: "checkbox",
        label: "Soft edge (fade with reveal)"
      }
    }
  },

  look: {
    component: "nested-object",
    label: "Look",
    fields: {
      hiddenColor: {
        component: "color",
        label: "Hidden color"
      },
      cellGap: {
        component: "slider",
        label: "Cell gap",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      grayscale: {
        component: "checkbox",
        label: "Grayscale reveal"
      }
    }
  },

  demo: {
    component: "nested-object",
    label: "Demo auto-wipe",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Enabled"
      },
      pointers: {
        component: "slider",
        label: "Pointers",
        min: 1,
        max: 5,
        step: 1
      },
      speed: {
        component: "slider",
        label: "Speed (snaps to whole cycles/loop)",
        min: 0,
        max: 3,
        step: 0.1
      }
    }
  }
};
