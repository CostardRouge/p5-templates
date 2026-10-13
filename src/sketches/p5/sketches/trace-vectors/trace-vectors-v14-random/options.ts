import {
  gridTraceFormConfiguration,
  gridTraceFormValuesBase
} from "../_grid-form";

export const formValues = {
  ...gridTraceFormValuesBase,
  text: {
    mode: "single",
    value: "#random()"
  },
  textStyle: {
    ...gridTraceFormValuesBase.textStyle,
    font: "sans",
    sampleFactor: 0.1
  },
  trajectory: {
    ...gridTraceFormValuesBase.trajectory,
    random: false
  },
  colors: {
    ...gridTraceFormValuesBase.colors,
    palette: "test",
    paletteBackground: false
  }
};

export const formConfiguration: Record<string, any> = gridTraceFormConfiguration;
