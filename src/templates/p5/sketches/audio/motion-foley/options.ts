import {
  categoryLabel,
  CATEGORY_LIST,
  defaultVariant,
  hasRelease,
  listVariants
} from "./_soundDesign.js";

/**
 * The form mirrors the sketch's two halves: a block of global controls (layout,
 * timing, tension/release, grouping, audio, appearance) followed by one
 * collapsible block per gesture so each shape can be toggled, re-voiced,
 * re-pitched and given its own resolving (release) sound.
 */

const titleCase = ( value: string ): string =>
  value.charAt( 0 ).toUpperCase() + value.slice( 1 );

const variantOptions = (
  category: string, phase: "tension" | "release"
) =>
  listVariants(
    category,
    phase
  ).map( ( variant ) => ( {
    label: titleCase( variant ),
    value: variant
  } ) );

const categoryValues = Object.fromEntries( CATEGORY_LIST.map( (
  category, index
) => [
  category,
  {
    // Only the first gesture is enabled by default, so the demo starts with a
    // single clean sound instead of all ten firing at once.
    enabled: index === 0,
    variant: defaultVariant(
      category,
      "tension"
    ),
    release: hasRelease( category ),
    releaseVariant: defaultVariant(
      category,
      "release"
    ),
    pitch: 1,
    volume: 1
  }
] ) );

const categoryConfiguration = Object.fromEntries( CATEGORY_LIST.map( ( category ) => [
  category,
  {
    component: "nested-object",
    label: categoryLabel( category ),
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      variant: {
        label: "Tension sound",
        component: "select",
        options: variantOptions(
          category,
          "tension"
        )
      },
      release: {
        label: "Release (resolve)",
        component: "checkbox"
      },
      releaseVariant: {
        label: "Release sound",
        component: "select",
        options: variantOptions(
          category,
          "release"
        )
      },
      pitch: {
        label: "Pitch",
        component: "slider",
        min: 0.25,
        max: 3,
        step: 0.05
      },
      volume: {
        label: "Volume",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.05
      }
    }
  }
] ) );

export const formValues = {
  layout: {
    columns: 0,
    shapeScale: 1,
    showLabels: true
  },
  timing: {
    animationDuration: 1.4,
    restDuration: 0.6,
    stagger: true,
    staggerSpread: 1
  },
  tensionRelease: {
    enabled: true,
    hold: 0.25,
    releaseDuration: 1
  },
  group: {
    count: 1,
    mode: "unison",
    spread: 0.5,
    sequenceSpread: 0.5
  },
  audio: {
    enabled: true,
    masterVolume: 0.8,
    gain: 0.5
  },
  appearance: {
    colorMode: "spectrum",
    baseColor: [
      255,
      255,
      255
    ] as number[],
    background: [
      10,
      10,
      16,
      255
    ] as number[]
  },
  ...categoryValues
};

export const formConfiguration: Record<string, any> = {
  layout: {
    component: "nested-object",
    label: "Layout",
    fields: {
      columns: {
        label: "Columns (0 = auto)",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      shapeScale: {
        label: "Shape scale",
        component: "slider",
        min: 0.3,
        max: 1.6,
        step: 0.05
      },
      showLabels: {
        label: "Show labels",
        component: "checkbox"
      }
    }
  },
  timing: {
    component: "nested-object",
    label: "Timing",
    fields: {
      animationDuration: {
        label: "Tension duration (s)",
        component: "slider",
        min: 0.2,
        max: 4,
        step: 0.1
      },
      restDuration: {
        label: "Rest between loops (s)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.1
      },
      stagger: {
        label: "Stagger tiles",
        component: "checkbox"
      },
      staggerSpread: {
        label: "Stagger amount",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      }
    }
  },
  tensionRelease: {
    component: "nested-object",
    label: "Tension / release",
    fields: {
      enabled: {
        label: "Resolve gestures",
        component: "checkbox"
      },
      hold: {
        label: "Hold at peak (s)",
        component: "slider",
        min: 0,
        max: 1.5,
        step: 0.05
      },
      releaseDuration: {
        label: "Release duration (s)",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      }
    }
  },
  group: {
    component: "nested-object",
    label: "Group (one or many items)",
    fields: {
      count: {
        label: "Items per gesture",
        component: "slider",
        min: 1,
        max: 4,
        step: 1
      },
      mode: {
        label: "Group sound",
        component: "select",
        options: [
          {
            label: "Unison",
            value: "unison"
          },
          {
            label: "Chord",
            value: "chord"
          },
          {
            label: "Arpeggio",
            value: "arpeggio"
          },
          {
            label: "Detune",
            value: "detune"
          }
        ]
      },
      spread: {
        label: "Pitch spread",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      },
      sequenceSpread: {
        label: "Arpeggio spread",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.05
      }
    }
  },
  audio: {
    component: "nested-object",
    label: "Audio",
    fields: {
      enabled: {
        label: "Enabled",
        component: "checkbox"
      },
      masterVolume: {
        label: "Master volume",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      gain: {
        label: "Per-voice gain",
        component: "slider",
        min: 0.05,
        max: 1,
        step: 0.05
      }
    }
  },
  appearance: {
    component: "nested-object",
    label: "Appearance",
    fields: {
      colorMode: {
        label: "Color mode",
        component: "select",
        options: [
          {
            label: "Spectrum",
            value: "spectrum"
          },
          {
            label: "Mono",
            value: "mono"
          }
        ]
      },
      baseColor: {
        label: "Mono color",
        component: "color"
      },
      background: {
        label: "Background",
        component: "color"
      }
    }
  },
  ...categoryConfiguration
};
