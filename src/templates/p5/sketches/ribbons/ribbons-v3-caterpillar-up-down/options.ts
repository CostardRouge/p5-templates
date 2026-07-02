import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  linesFormValues,
  linesFormConfiguration,
  opacityFormValues,
  opacityFormConfiguration,
  rotationFormValues,
  rotationFormConfiguration,
  colorsFormValues,
  colorsFormConfiguration,
  shapeFormValues,
  shapeFormConfiguration
} from "../_options";

export const formValues = {
  shape: {
    ...shapeFormValues( 200 ),
    orbitX: 200,
    verticalMargin: 50,
    zDivisorMin: 2,
    zDivisorMax: 4,
    regularLengthValue: 1.5,
    driftAmplitude: 1.5
  },
  lines: linesFormValues( {
    length: 40,
    weight: 80,
    maxCount: 8,
    changeCount: true,
    regularLength: true
  } ),
  opacity: opacityFormValues( {
    speed: 3,
    startFactor: 3
  } ),
  rotation: rotationFormValues( {
    count: 1,
    speed: 2
  } ),
  colors: colorsFormValues( {
    palette: "rainbow"
  } ),
  background: {
    columns: 3,
    rows: 3,
    alpha: 5,
    weight: 3,
    tint: [
      255,
      255,
      255
    ] as number[],
    animationSpeed: 1
  },
  backgroundColor: [
    0,
    0,
    0,
    255
  ] as number[],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  shape: shapeFormConfiguration( {
    orbitX: {
      component: "slider",
      label: "Orbit X",
      min: 50,
      max: 800,
      step: 1
    },
    verticalMargin: {
      component: "slider",
      label: "Vertical margin",
      min: 0,
      max: 400,
      step: 1
    },
    zDivisorMin: {
      component: "slider",
      label: "Z divisor min",
      min: 0.1,
      max: 10,
      step: 0.1
    },
    zDivisorMax: {
      component: "slider",
      label: "Z divisor max",
      min: 0.1,
      max: 10,
      step: 0.1
    },
    regularLengthValue: {
      component: "slider",
      label: "Regular length value",
      min: 0.1,
      max: 5,
      step: 0.01
    },
    driftAmplitude: {
      component: "slider",
      label: "Drift amplitude",
      min: 0,
      max: 10,
      step: 0.01
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration(),
  colors: colorsFormConfiguration(),
  background: {
    component: "nested-object",
    label: "Background grid",
    fields: {
      columns: {
        component: "slider",
        label: "Columns",
        min: 1,
        max: 30,
        step: 1
      },
      rows: {
        component: "slider",
        label: "Rows",
        min: 1,
        max: 30,
        step: 1
      },
      alpha: {
        component: "slider",
        label: "Alpha",
        min: 0,
        max: 255,
        step: 1
      },
      weight: {
        component: "slider",
        label: "Weight",
        min: 1,
        max: 20,
        step: 1
      },
      tint: {
        component: "color",
        label: "Grid tint"
      },
      animationSpeed: {
        component: "slider",
        label: "Animation speed (snaps to whole cycles/loop)",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
