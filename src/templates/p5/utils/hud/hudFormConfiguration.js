import {
  Blend
} from "@/types/sketch.types";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

/**
 * Shared form configuration for the HUD / telemetry block.
 *
 * Spread into a sketch's formConfiguration as `hud: hudFormConfiguration`.
 * v1 uses fixed widget slots (one nested-object per type, each with its own
 * `enabled`) — exactly like interactionFormConfiguration — so it needs no Zod
 * schema (only conditional-group does).
 */

const fontField = {
  label: "Font",
  component: "select",
  options: fontNames.map( ( fontName ) => ( {
    value: fontName,
    label: fontName
  } ) )
};

const blendField = {
  label: "Blend",
  component: "select",
  options: Blend.options.map( ( blendOption ) => ( {
    value: blendOption,
    label: blendOption
  } ) )
};

const anchorField = {
  label: "Anchor",
  component: "select",
  options: [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
    "center"
  ].map( ( value ) => ( {
    value,
    label: value
  } ) )
};

const offsetField = {
  label: "Offset (0-1)",
  component: "nested-object",
  fields: {
    x: {
      label: "x",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01
    },
    y: {
      label: "y",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01
    }
  }
};

const sourceField = {
  label: "Source / probe",
  component: "text",
  placeholder: "fps | resolution | frame | progress% | <probeName>"
};

const sizeField = ( max = 96 ) => ( {
  label: "Size",
  component: "slider",
  min: 8,
  max,
  step: 1
} );

const enabledField = {
  label: "Enabled",
  component: "checkbox"
};

const windowFields = {
  displayFrom: {
    label: "Display from (0-1)",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  },
  displayTo: {
    label: "Display to (0-1)",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  }
};

const rangeFields = {
  min: {
    label: "Min",
    component: "number"
  },
  max: {
    label: "Max",
    component: "number"
  }
};

const decimalsField = {
  label: "Decimals",
  component: "slider",
  min: 0,
  max: 4,
  step: 1
};

const unitField = {
  label: "Unit",
  component: "text"
};

const labelField = {
  label: "Label override",
  component: "text"
};

const fillField = {
  label: "Fill",
  component: "color"
};

const phaseFields = {
  revealEnd: {
    label: "Reveal end",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  },
  holdEnd: {
    label: "Hold end",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  },
  fadeEnd: {
    label: "Fade end",
    component: "slider",
    min: 0,
    max: 1,
    step: 0.01
  }
};

const specWidgetFields = {
  enabled: enabledField,
  offset: offsetField,
  size: sizeField(),
  fill: fillField,
  font: fontField,
  blend: blendField,
  showCursor: {
    label: "Blinking cursor",
    component: "checkbox"
  },
  includeSketchSettings: {
    label: "Include sketch settings",
    component: "checkbox"
  },
  ...phaseFields
};

const hudFormConfiguration = {
  label: "HUD / Telemetry",
  component: "nested-object",
  fields: {
    enabled: {
      label: "Show HUD",
      component: "checkbox"
    },
    fill: {
      label: "Default fill",
      component: "color"
    },
    font: fontField,
    blend: blendField,

    badge: {
      label: "Badge (resolution · fps)",
      component: "nested-object",
      fields: {
        enabled: enabledField,
        anchor: anchorField,
        offset: offsetField,
        size: sizeField(),
        fill: fillField,
        font: fontField,
        blend: blendField
      }
    },

    bootLog: {
      label: "Boot log",
      component: "nested-object",
      fields: specWidgetFields
    },

    ticker: {
      label: "Ticker",
      component: "nested-object",
      fields: specWidgetFields
    },

    gauge: {
      label: "Gauge",
      component: "nested-object",
      fields: {
        enabled: enabledField,
        source: sourceField,
        anchor: anchorField,
        offset: offsetField,
        size: sizeField( 48 ),
        ...rangeFields,
        label: labelField,
        unit: unitField,
        decimals: decimalsField,
        easingFn: {
          label: "Fill easing",
          component: "easing"
        },
        fill: fillField,
        blend: blendField,
        ...windowFields
      }
    },

    sparkline: {
      label: "Sparkline",
      component: "nested-object",
      fields: {
        enabled: enabledField,
        source: sourceField,
        anchor: anchorField,
        offset: offsetField,
        size: sizeField( 48 ),
        ...rangeFields,
        historySize: {
          label: "History points",
          component: "slider",
          min: 8,
          max: 180,
          step: 1
        },
        decimals: decimalsField,
        unit: unitField,
        fill: fillField,
        blend: blendField,
        ...windowFields
      }
    },

    counter: {
      label: "Counter",
      component: "nested-object",
      fields: {
        enabled: enabledField,
        source: sourceField,
        anchor: anchorField,
        offset: offsetField,
        size: sizeField( 160 ),
        label: labelField,
        unit: unitField,
        decimals: decimalsField,
        fill: fillField,
        blend: blendField,
        ...windowFields
      }
    },

    crosshairs: {
      label: "Crosshairs",
      component: "nested-object",
      fields: {
        enabled: enabledField,
        source: sourceField,
        size: sizeField( 48 ),
        fill: fillField,
        blend: blendField,
        ...windowFields
      }
    },

    swatch: {
      label: "Color swatch",
      component: "nested-object",
      fields: {
        enabled: enabledField,
        source: sourceField,
        anchor: anchorField,
        offset: offsetField,
        size: sizeField( 48 ),
        label: labelField,
        fill: fillField,
        font: fontField,
        blend: blendField,
        ...windowFields
      }
    },

    boundingBox: {
      label: "Bounding box",
      component: "nested-object",
      fields: {
        enabled: enabledField,
        source: sourceField,
        size: sizeField( 48 ),
        region: {
          label: "Region (0-1)",
          component: "nested-object",
          fields: {
            x: {
              label: "x",
              component: "slider",
              min: 0,
              max: 1,
              step: 0.01
            },
            y: {
              label: "y",
              component: "slider",
              min: 0,
              max: 1,
              step: 0.01
            },
            w: {
              label: "w",
              component: "slider",
              min: 0,
              max: 1,
              step: 0.01
            },
            h: {
              label: "h",
              component: "slider",
              min: 0,
              max: 1,
              step: 0.01
            }
          }
        },
        label: labelField,
        fill: fillField,
        blend: blendField,
        ...windowFields
      }
    }
  }
};

export default hudFormConfiguration;
