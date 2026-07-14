import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

const COLOR_MODE_OPTIONS = [
  {
    label: "Rainbow",
    value: "rainbow"
  },
  {
    label: "Single color",
    value: "mono"
  }
];

// Default values only — exposed at runtime as `options.sketch.*`.
export const formValues = {
  text: {
    content: "DROP",
    font: "martian",
    size: 0.2,
    colorMode: "rainbow",
    hueSpread: 2.1,
    fill: [
      245,
      240,
      230
    ]
  },

  // The simulation is deterministic: the same values always produce the same
  // drop, so recorded exports are reproducible. `dropSpread` / `settleSteps`
  // together set how long the loop takes to fill and settle.
  physics: {
    gravity: 1.1,
    bounce: 0.45,
    friction: 0.6,
    dropSpread: 7,
    settleSteps: 245,
    spin: 0.55,
    seed: 7
  },

  scene: {
    backgroundColor: [
      12,
      12,
      16
    ],
    margin: 0.06,
    floor: 0.08,
    showFloor: true,
    floorColor: [
      60,
      60,
      70
    ],
    floorWeight: 7
  }
};

// UI configuration only.
export const formConfiguration: Record<string, any> = {
  text: {
    component: "nested-object",
    label: "Text",
    initialExpanded: true,
    fields: {
      content: {
        component: "text",
        label: "Phrase (letters that drop)"
      },
      font: {
        component: "select",
        label: "Font",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        component: "slider",
        label: "Letter size (× canvas width)",
        min: 0.04,
        max: 0.4,
        step: 0.01
      },
      colorMode: {
        component: "select",
        label: "Color mode",
        options: COLOR_MODE_OPTIONS
      },
      hueSpread: {
        component: "slider",
        label: "Rainbow spread",
        min: 0,
        max: 4,
        step: 0.1
      },
      fill: {
        component: "color",
        label: "Letter color (single color mode)"
      }
    }
  },

  physics: {
    component: "nested-object",
    label: "Physics",
    initialExpanded: true,
    fields: {
      gravity: {
        component: "slider",
        label: "Gravity",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      bounce: {
        component: "slider",
        label: "Bounciness",
        min: 0,
        max: 1,
        step: 0.05
      },
      friction: {
        component: "slider",
        label: "Friction",
        min: 0,
        max: 1,
        step: 0.05
      },
      dropSpread: {
        component: "slider",
        label: "Steps between drops",
        min: 1,
        max: 30,
        step: 1
      },
      settleSteps: {
        component: "slider",
        label: "Settle time (steps)",
        min: 20,
        max: 400,
        step: 5
      },
      spin: {
        component: "slider",
        label: "Tumble spin",
        min: 0,
        max: 1,
        step: 0.05
      },
      seed: {
        component: "slider",
        label: "Layout seed",
        min: 0,
        max: 200,
        step: 1
      }
    }
  },

  scene: {
    component: "nested-object",
    label: "Scene",
    fields: {
      backgroundColor: {
        component: "color",
        label: "Background color"
      },
      margin: {
        component: "slider",
        label: "Side margin (× canvas width)",
        min: 0,
        max: 0.3,
        step: 0.01
      },
      floor: {
        component: "slider",
        label: "Floor height (× canvas height)",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      showFloor: {
        component: "checkbox",
        label: "Show floor line"
      },
      floorColor: {
        component: "color",
        label: "Floor color"
      },
      floorWeight: {
        component: "slider",
        label: "Floor line weight",
        min: 0,
        max: 20,
        step: 1
      }
    }
  }
};
