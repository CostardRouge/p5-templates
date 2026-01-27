import easing from "@/p5/utils/easing";

import camelCaseToSpace from "@/utils/camelCaseToSpace";
import capitalize from "@/utils/capitalize";

type FixedOption = {
  mode: "fixed",
  value: number
}

type VariableOption<T> = {
  mode: "variable",
  start: T,
  end: T,
  count: number,
  speedMultiplier: number,
  progressionMultiplier: number,
  easingFn: string
}

export function createFixedOrVariableOption(
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
        start: {
          label: `${ capitalizedOptionName } start`,
          component: "slider",
          min,
          max,
          step,
        },
        end: {
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

export function createSingleOrMultipleTextOption( optionName: string ) {
  const spacedOptionName = camelCaseToSpace( optionName );
  const capitalizedOptionName = capitalize( spacedOptionName );

  return ( {
    label: capitalizedOptionName,
    component: "conditional-group",
    conditionalOn: "mode",
    typeSelector: {
      options: [
        {
          label: "Single (letter by letter)",
          value: "single",
        },
        {
          label: "Multiple (word by word)",
          value: "multiple",
        },
      ],
    },
    configs: {
      single: {
        value: {
          label: "single",
          component: "text",
        },
      },
      multiple: {
        value: {
          label: "multiple",
          component: "item-list",
          itemConfig: {
            label: "Multiple",
            defaultItems: [
              "one",
              "two",
              "three"
            ]
          }
        },
      }
    }
  } );
}

export function createVariableOption(
  optionName: string, optionConfiguration: Record<string, number>
) {
  const spacedOptionName = camelCaseToSpace( optionName );
  const capitalizedOptionName = capitalize( spacedOptionName );
  const {
    min, max, step
  } = optionConfiguration;

  return ( {
    label: capitalizedOptionName,
    component: "nested-object",
    fields: {
      generalMultiplier: {
        label: "General multiplier",
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
      },
      start: {
        label: `${ capitalizedOptionName } start`,
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
      },
      end: {
        label: `${ capitalizedOptionName } end`,
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
      },
      xMultiplier: {
        label: `${ capitalizedOptionName } xMultiplier`,
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
      },
      yMultiplier: {
        label: `${ capitalizedOptionName } yMultiplier`,
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
      },
      zMultiplier: {
        label: `${ capitalizedOptionName } zMultiplier`,
        component: "slider",
        min: -9,
        max: 9,
        step: 0.1,
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
  } );
}