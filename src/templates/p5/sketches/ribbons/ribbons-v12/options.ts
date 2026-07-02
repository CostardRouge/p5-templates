import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  linesFormValues,
  linesFormConfiguration,
  opacityFormValues,
  opacityFormConfiguration,
  colorsFormValues,
  colorsFormConfiguration,
  shapeFormValues,
  shapeFormConfiguration,
  blurredBackgroundFormValues,
  blurredBackgroundFormConfiguration
} from "../_options";

export const formValues = {
  shape: {
    ...shapeFormValues( 200 ),
    foldCycle: [
      1,
      2,
      3,
      4
    ],
    foldLerp: 0.001,
    breathSpeed: 1,
    breathPhase: 1
  },
  rotation: {
    speed: 0.5,
    indexMultiplier: 1,
    wobble: 1
  },
  lines: linesFormValues( {
    length: 190,
    weight: 110,
    maxCount: 3
  } ),
  opacity: opacityFormValues( {
    pingPong: true,
    speed: 2,
    groupCount: 1,
    startFactor: 12
  } ),
  colors: {
    hueSpeed: 2,
    palette: "rainbow",
    lineKeyedRainbow: true
  },
  background: blurredBackgroundFormValues( {
    linesAmount: 100,
    linesWeight: 8
  } ),
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
    foldLerp: {
      component: "slider",
      label: "Fold lerp (smoothing)",
      min: 0.0001,
      max: 0.1,
      step: 0.0001
    },
    breathSpeed: {
      component: "slider",
      label: "Breath speed (snaps to whole cycles/loop)",
      min: -5,
      max: 5,
      step: 0.01
    },
    breathPhase: {
      component: "slider",
      label: "Breath phase per line",
      min: -5,
      max: 5,
      step: 0.01
    }
  } ),
  rotation: {
    component: "nested-object",
    label: "Rotation",
    fields: {
      speed: {
        component: "slider",
        label: "Rotation speed (snaps to whole turns/loop)",
        min: -3,
        max: 3,
        step: 0.01
      },
      indexMultiplier: {
        component: "slider",
        label: "Index multiplier",
        min: -5,
        max: 5,
        step: 0.01
      },
      wobble: {
        component: "slider",
        label: "Wobble amplitude",
        min: -3,
        max: 3,
        step: 0.01
      }
    }
  },
  lines: linesFormConfiguration(),
  opacity: opacityFormConfiguration(),
  colors: colorsFormConfiguration( {
    lineKeyedRainbow: {
      component: "checkbox",
      label: "Line-keyed rainbow override"
    }
  } ),
  background: blurredBackgroundFormConfiguration(),
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
