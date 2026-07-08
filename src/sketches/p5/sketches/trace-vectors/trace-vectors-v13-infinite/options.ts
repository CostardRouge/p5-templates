import {
  gridTraceFormConfiguration,
  gridTraceFormValuesBase
} from "../_grid-form";

export const formValues = {
  ...gridTraceFormValuesBase,
  text: {
    mode: "single",
    value: "#infinite"
  },
  textStyle: {
    ...gridTraceFormValuesBase.textStyle,
    sampleFactor: 0.1
  }
};

export const formConfiguration: Record<string, any> = gridTraceFormConfiguration;
