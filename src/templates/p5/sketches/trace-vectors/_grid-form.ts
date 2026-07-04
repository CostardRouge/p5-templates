import {
  textForm,
  textStyleForm,
  colorsForm,
  loopForm,
  baseDefaults
} from "./_form";

export const gridSectionForm = {
  component: "nested-object",
  label: "Background grid",
  fields: {
    show: {
      label: "Show grid lines?",
      component: "checkbox"
    },
    columns: {
      label: "Columns",
      component: "slider",
      min: 1,
      max: 12,
      step: 1
    },
    rows: {
      label: "Rows",
      component: "slider",
      min: 1,
      max: 12,
      step: 1
    },
    weight: {
      label: "Line weight",
      component: "slider",
      min: 0.1,
      max: 4,
      step: 0.1
    },
    showCellLabels: {
      label: "Show cell labels?",
      component: "checkbox"
    },
    cellLabelSize: {
      label: "Cell label size",
      component: "slider",
      min: 6,
      max: 80,
      step: 1
    }
  }
};

export const trajectoryForm = {
  component: "nested-object",
  label: "Trajectory",
  fields: {
    random: {
      label: "Randomize?",
      component: "checkbox"
    },
    linesWeight: {
      label: "Lines weight (0 = off)",
      component: "slider",
      min: 0,
      max: 10,
      step: 0.1
    },
    pointsWeight: {
      label: "Points weight (0 = off)",
      component: "slider",
      min: 0,
      max: 10,
      step: 0.1
    },
    pointsInterval: {
      label: "Points interval",
      component: "slider",
      min: 0.01,
      max: 0.5,
      step: 0.005
    }
  }
};

export const tracedAdvancedForm = {
  component: "nested-object",
  label: "Traced lines",
  fields: {
    steps: {
      label: "Steps",
      component: "slider",
      min: 1,
      max: 255,
      step: 1
    },
    weight: {
      label: "Stroke weight",
      component: "slider",
      min: 0.5,
      max: 20,
      step: 0.1
    },
    smooth: {
      label: "Smooth",
      component: "checkbox"
    },
    useChunks: {
      label: "Use chunks",
      component: "checkbox"
    },
    chunksCount: {
      label: "Chunks count",
      component: "slider",
      min: 1,
      max: 50,
      step: 1
    }
  }
};

export const extremesPointsForm = {
  component: "nested-object",
  label: "Extremity dots",
  fields: {
    weight: {
      label: "Stroke weight (0 = off)",
      component: "slider",
      min: 0,
      max: 20,
      step: 0.5
    }
  }
};

export const lettersForm = {
  component: "nested-object",
  label: "Letters",
  fields: {
    speed: {
      label: "Text sweeps per loop",
      component: "slider",
      min: 1,
      max: 8,
      step: 1
    }
  }
};

export const gridTraceFormConfiguration: Record<string, any> = {
  text: textForm,
  textStyle: textStyleForm,
  grid: gridSectionForm,
  trajectory: trajectoryForm,
  letters: lettersForm,
  traced: tracedAdvancedForm,
  extremes: extremesPointsForm,
  colors: colorsForm,
  loop: loopForm,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};

export const gridTraceFormValuesBase = {
  ...baseDefaults,
  grid: {
    show: true,
    columns: 3,
    rows: 3,
    weight: 0.5,
    showCellLabels: true,
    cellLabelSize: 22
  },
  trajectory: {
    random: false,
    linesWeight: 1,
    pointsWeight: 3,
    pointsInterval: 0.05
  },
  letters: {
    speed: 1
  },
  traced: {
    steps: 33,
    weight: 4,
    smooth: true,
    useChunks: false,
    chunksCount: 1
  },
  extremes: {
    weight: 4
  },
  colors: {
    hueIndexMultiplier: 8,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 2.5
  },
  loop: {
    timeScale: 1,
    timeOffset: 0
  }
};
