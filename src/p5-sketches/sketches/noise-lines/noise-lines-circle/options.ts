import titleFormConfiguration from "@/p5-sketches/utils/title/titleFormConfiguration";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import capitalize from "@/utils/capitalize";
import easing from "@/p5/utils/easing";
import camelCaseToSpace from "@/utils/camelCaseToSpace";

function createFixedOrVariableOption(
  optionName: string, optionConfiguration: Record<string, number>
) {
  const spacedOptionName = camelCaseToSpace( optionName );
  const capitalizedOptionName = capitalize( spacedOptionName );
  const {
    min, max, step
  } = optionConfiguration;

  return ( {
    label: capitalizedOptionName,
    component: "conditional-group",
    conditionalOn: "mode",
    typeSelector: {
      options: [
        {
          label: `Fixed ${ spacedOptionName.toLowerCase() }`,
          value: "fixed",
        },
        {
          label: `Variable ${ spacedOptionName.toLowerCase() }`,
          value: "variable",
        },
      ],
    },
    configs: {
      fixed: {
        value: {
          label: `Fixed ${ spacedOptionName.toLowerCase() }`,
          component: "slider",
          min,
          max,
          step,
        },
      },
      variable: {
        speedMultiplier: {
          label: "Speed multiplier",
          component: "slider",
          min: 0,
          max: 10,
          step: 0.1,
        },
        progressionMultiplier: {
          label: "Progression multiplier",
          component: "slider",
          min: 0,
          max: 100,
          step: 0.1,
        },
        startValue: {
          label: `${ capitalizedOptionName } start`,
          component: "slider",
          min,
          max,
          step,
        },
        endValue: {
          label: `${ capitalizedOptionName } end`,
          component: "slider",
          min,
          max,
          step,
        },
        easingFn: {
          component: "select",
          label: `${ capitalizedOptionName } easing`,
          options: Object.keys( easing ).map( ( easingFunctionName ) => ( {
            label: easingFunctionName,
            value: easingFunctionName,
          } ) ),
        },
      },
    },
    // Schema is injected client-side in injectSketchSchemas.ts
    // See schemas.ts for WaveConfigSchema definition
  } );
}

export const formValues = {
  shape: {
    stroke: [
      0
    ],
    strokeWeight: 3.9,
    linesCount: 200,
    incrementStep: 0.05,
  },
  roughness: {
    mode: "fixed",
    value: 1.5
  },
  magnitude: {
    mode: "variable",
    count: 1,
    speedMultiplier: 1,
    progressionMultiplier: 1,
    startValue: 125,
    endValue: 225,
    easingFn: "easeInOutExpo",
  },
  baseRadius: {
    mode: "variable",
    count: 1,
    speedMultiplier: 1,
    progressionMultiplier: 1,
    startValue: 190.5,
    endValue: 200,
    easingFn: "easeInOutExpo",
  },
  radiusOffsetMultiplier: {
    mode: "variable",
    count: 1,
    speedMultiplier: 1,
    progressionMultiplier: 1,
    startValue: 4,
    endValue: 5.70,
    easingFn: "easeInOutSine",
  },
  noisePhaseMultiplier: {
    mode: "variable",
    count: 1,
    speedMultiplier: 3,
    progressionMultiplier: 1,
    startValue: 0.02,
    endValue: 0.03,
    easingFn: "easeInOutBack",
  },
  backgroundColor: [
    246,
    235,
    225
  ],
  title: titleDefaultValues,
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  shape: {
    component: "nested-object",
    label: "Shape",
    fields: {
      stroke: {
        label: "Stroke",
        component: "color",
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1,
      },
      linesCount: {
        label: "Lines count",
        component: "slider",
        min: 1,
        max: 1000,
        step: 1,
      },
      incrementStep: {
        label: "Increment step",
        component: "slider",
        min: 0.01,
        max: 3.14,
        step: 0.01,
      },
    },
  },
  roughness: createFixedOrVariableOption(
    "roughness",
    {
      min: 0,
      max: 10,
      step: 0.1
    }
  ),
  magnitude: createFixedOrVariableOption(
    "magnitude",
    {
      min: 0,
      max: 500,
      step: 0.1
    }
  ),
  baseRadius: createFixedOrVariableOption(
    "baseRadius",
    {
      min: 10,
      max: 500,
      step: 0.1
    }
  ),
  radiusOffsetMultiplier: createFixedOrVariableOption(
    "radiusOffsetMultiplier",
    {
      min: 0.1,
      max: 15,
      step: 0.1
    }
  ),
  noisePhaseMultiplier: createFixedOrVariableOption(
    "noisePhaseMultiplier",
    {
      min: 0.01,
      max: 1,
      step: 0.01
    }
  ),

  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color",
  },
};
