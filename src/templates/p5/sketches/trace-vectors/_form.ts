import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import {
  createSingleOrMultipleTextOption
} from "@/utils/sketchOptionUtils";

export const textForm = createSingleOrMultipleTextOption( "text" );

export const textStyleForm = {
  component: "nested-object",
  label: "Text style",
  fields: {
    font: {
      component: "select",
      label: "Font",
      options: fontNames.map( ( fontName ) => ( {
        value: fontName,
        label: fontName
      } ) )
    },
    size: {
      label: "Size (× canvas width)",
      component: "slider",
      min: 0.05,
      max: 2,
      step: 0.01
    },
    sampleFactor: {
      label: "Sample factor",
      component: "slider",
      min: 0.01,
      max: 1,
      step: 0.01
    }
  }
};

export const gridForm = {
  component: "nested-object",
  label: "Background grid",
  fields: {
    show: {
      label: "Show grid?",
      component: "checkbox"
    },
    columns: {
      label: "Columns",
      component: "slider",
      min: 1,
      max: 50,
      step: 1
    },
    rows: {
      label: "Rows",
      component: "slider",
      min: 1,
      max: 50,
      step: 1
    },
    weight: {
      label: "Line weight",
      component: "slider",
      min: 0.1,
      max: 4,
      step: 0.1
    }
  }
};

export const tracedForm = {
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
    }
  }
};

export const colorsForm = {
  component: "nested-object",
  label: "Colors",
  fields: {
    hueIndexMultiplier: {
      label: "Hue index multiplier",
      component: "slider",
      min: 0,
      max: 32,
      step: 0.1
    },
    hueOffset: {
      label: "Hue offset",
      component: "slider",
      min: -Math.PI,
      max: Math.PI,
      step: 0.01
    },
    opacityMin: {
      label: "Opacity min",
      component: "slider",
      min: 0.5,
      max: 10,
      step: 0.1
    },
    opacityMax: {
      label: "Opacity max",
      component: "slider",
      min: 0.5,
      max: 10,
      step: 0.1
    }
  }
};

export const loopForm = {
  component: "nested-object",
  label: "Loop",
  fields: {
    timeScale: {
      label: "Time scale (cycles per loop)",
      component: "slider",
      min: 0,
      max: 16,
      step: 0.1
    },
    timeOffset: {
      label: "Time offset",
      component: "slider",
      min: 0,
      max: 16,
      step: 0.01
    }
  }
};

export const baseDefaults = {
  textStyle: {
    font: "martian",
    size: 0.66,
    sampleFactor: 0.15
  },
  grid: {
    show: true,
    columns: 20,
    rows: 26,
    weight: 0.5
  },
  traced: {
    steps: 33,
    weight: 4
  },
  colors: {
    hueIndexMultiplier: 6,
    hueOffset: 0,
    opacityMin: 1.5,
    opacityMax: 3.5
  },
  loop: {
    timeScale: 2,
    timeOffset: 0
  },
  backgroundColor: [
    0,
    0,
    0
  ]
};
