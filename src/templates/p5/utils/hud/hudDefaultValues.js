/**
 * Default form values for the shared HUD / telemetry block.
 *
 * Spread into a sketch's formValues as `hud: hudDefaultValues`. The master
 * `enabled` flag is OFF so adopting the block never changes a sketch until the
 * user turns it on. Each widget is an independently-toggled slot (v1: one
 * instance per type — multi-instance via item-list is a future iteration).
 */

const hudDefaultValues = {
  enabled: false,
  fill: [
    0,
    255,
    120,
    255
  ],
  font: "spaceMonoRegular",
  blend: "source-over",

  badge: {
    enabled: true,
    anchor: "top-right",
    offset: {
      x: 0.95,
      y: 0.06
    },
    size: 20
  },

  bootLog: {
    enabled: false,
    offset: {
      x: 0.05,
      y: 0.06
    },
    size: 22,
    lineHeight: 1.4,
    showCursor: true,
    includeSketchSettings: false,
    revealEnd: 0.45,
    holdEnd: 0.7,
    fadeEnd: 0.85
  },

  ticker: {
    enabled: false,
    offset: {
      x: 0.05,
      y: 0.94
    },
    size: 22,
    showCursor: true,
    includeSketchSettings: true,
    revealEnd: 0.9,
    holdEnd: 0.95,
    fadeEnd: 1
  },

  gauge: {
    enabled: false,
    anchor: "bottom-left",
    offset: {
      x: 0.05,
      y: 0.9
    },
    size: 18,
    source: "progress%",
    min: 0,
    max: 100,
    label: "",
    unit: "",
    decimals: 0,
    easingFn: "linear",
    displayFrom: 0,
    displayTo: 1
  },

  sparkline: {
    enabled: false,
    anchor: "bottom-right",
    offset: {
      x: 0.95,
      y: 0.9
    },
    size: 16,
    source: "progress%",
    min: 0,
    max: 100,
    historySize: 120,
    decimals: 0,
    displayFrom: 0,
    displayTo: 1
  },

  counter: {
    enabled: false,
    anchor: "top-left",
    offset: {
      x: 0.05,
      y: 0.85
    },
    size: 28,
    source: "frame",
    label: "",
    unit: "",
    decimals: 0,
    displayFrom: 0,
    displayTo: 1
  },

  crosshairs: {
    enabled: false,
    source: "center",
    size: 16,
    displayFrom: 0,
    displayTo: 1
  },

  swatch: {
    enabled: false,
    anchor: "top-right",
    offset: {
      x: 0.95,
      y: 0.2
    },
    size: 18,
    source: "",
    label: "COLOR",
    displayFrom: 0,
    displayTo: 1
  },

  boundingBox: {
    enabled: false,
    size: 14,
    source: "",
    region: {
      x: 0.2,
      y: 0.2,
      w: 0.6,
      h: 0.6
    },
    label: "ROI",
    displayFrom: 0,
    displayTo: 1
  }
};

export default hudDefaultValues;
