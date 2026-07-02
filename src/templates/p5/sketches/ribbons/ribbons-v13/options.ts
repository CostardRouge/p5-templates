import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import {
  opacityFormValues,
  opacityFormConfiguration,
  colorsFormValues,
  colorsFormConfiguration,
  blurredBackgroundFormValues,
  blurredBackgroundFormConfiguration
} from "../_options";

export const formValues = {
  shape: {
    rayCount: 20,
    lerpStep: 0.01,
    sizeDivisor: 10,
    sweepDriftSpeed: 0.25,
    lerpAmpMin: 0.5,
    lerpAmpMax: 1
  },
  lines: {
    weightMin: 3,
    weightMax: 70
  },
  opacity: opacityFormValues( {
    speed: 2,
    groupCount: 1,
    startFactor: 3
  } ),
  colors: colorsFormValues( {
    palette: "rainbow",
    easingChangeSpeed: 1,
    easingAngleDivisor: 5
  } ),
  background: blurredBackgroundFormValues( {
    linesAmount: 100,
    linesWeight: 8,
    animationSpeed: 0.25
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
  shape: {
    component: "nested-object",
    label: "Rays",
    fields: {
      rayCount: {
        component: "slider",
        label: "Ray count",
        min: 1,
        max: 100,
        step: 1
      },
      lerpStep: {
        component: "slider",
        label: "Points per ray (step)",
        min: 0.005,
        max: 0.2,
        step: 0.001
      },
      sizeDivisor: {
        component: "slider",
        label: "Size divisor",
        min: 1,
        max: 30,
        step: 0.1
      },
      sweepDriftSpeed: {
        component: "slider",
        label: "Sweep drift speed (snaps to whole turns/loop)",
        min: -2,
        max: 2,
        step: 0.01
      },
      lerpAmpMin: {
        component: "slider",
        label: "Ray contract min",
        min: 0,
        max: 1,
        step: 0.01
      },
      lerpAmpMax: {
        component: "slider",
        label: "Ray contract max",
        min: 0,
        max: 1.5,
        step: 0.01
      }
    }
  },
  lines: {
    component: "nested-object",
    label: "Point weight",
    fields: {
      weightMin: {
        component: "slider",
        label: "Min weight (tip)",
        min: 0.5,
        max: 300,
        step: 0.5
      },
      weightMax: {
        component: "slider",
        label: "Max weight (base)",
        min: 0.5,
        max: 300,
        step: 0.5
      }
    }
  },
  opacity: opacityFormConfiguration(),
  colors: colorsFormConfiguration( {
    easingChangeSpeed: {
      component: "slider",
      label: "Easing function change speed (snaps to whole cycles/loop)",
      min: 0,
      max: 10,
      step: 0.01
    },
    easingAngleDivisor: {
      component: "slider",
      label: "Easing angle divisor",
      min: 0.5,
      max: 30,
      step: 0.1
    }
  } ),
  background: blurredBackgroundFormConfiguration(),
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
