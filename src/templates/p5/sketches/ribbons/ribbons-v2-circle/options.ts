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
    ...shapeFormValues( 1000 ),
    xDivisor: 2,
    yDivisor: 4
  },
  lines: linesFormValues( {
    length: 40,
    weight: 80,
    maxCount: 1
  } ),
  opacity: opacityFormValues( {
    pingPong: true,
    speed: -2,
    startFactor: 3
  } ),
  rotation: rotationFormValues( {
    count: 1,
    speed: 2,
    wobbleSpeed: 0.5
  } ),
  colors: colorsFormValues( {
    palette: "purple"
  } ),
  background: {
    count: 15,
    maxWeight: 50,
    alpha: 90,
    tint: [
      128,
      128,
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
    xDivisor: {
      component: "slider",
      label: "X radius divisor",
      min: 1,
      max: 10,
      step: 0.1
    },
    yDivisor: {
      component: "slider",
      label: "Y radius divisor",
      min: 1,
      max: 10,
      step: 0.1
    }
  } ),
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  rotation: rotationFormConfiguration( {
    speed: {
      component: "slider",
      label: "Rotation speed (snaps to whole turns/loop)",
      min: -10,
      max: 10,
      step: 0.1
    },
    wobbleSpeed: {
      component: "slider",
      label: "Wobble speed (snaps to whole turns/loop)",
      min: -5,
      max: 5,
      step: 0.01
    }
  } ),
  colors: colorsFormConfiguration(),
  background: {
    component: "nested-object",
    label: "Background circles",
    fields: {
      count: {
        component: "slider",
        label: "Circle count",
        min: 1,
        max: 60,
        step: 1
      },
      maxWeight: {
        component: "slider",
        label: "Max stroke weight",
        min: 1,
        max: 200,
        step: 1
      },
      alpha: {
        component: "slider",
        label: "Alpha",
        min: 0,
        max: 255,
        step: 1
      },
      tint: {
        component: "color",
        label: "Tint"
      },
      animationSpeed: {
        component: "slider",
        label: "Animation speed (snaps to whole wraps/loop)",
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
