import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

const EASING_OPTIONS = [
  {
    label: "Linear",
    value: "linear"
  },
  {
    label: "Ease in quad",
    value: "easeInQuad"
  },
  {
    label: "Ease out quad",
    value: "easeOutQuad"
  },
  {
    label: "Ease in/out quad",
    value: "easeInOutQuad"
  },
  {
    label: "Ease in cubic",
    value: "easeInCubic"
  },
  {
    label: "Ease out cubic",
    value: "easeOutCubic"
  },
  {
    label: "Ease in/out cubic",
    value: "easeInOutCubic"
  },
  {
    label: "Ease in expo",
    value: "easeInExpo"
  },
  {
    label: "Ease out expo",
    value: "easeOutExpo"
  },
  {
    label: "Ease in/out expo",
    value: "easeInOutExpo"
  },
  {
    label: "Ease in elastic",
    value: "easeInElastic"
  },
  {
    label: "Ease out elastic",
    value: "easeOutElastic"
  },
  {
    label: "Ease in/out elastic",
    value: "easeInOutElastic"
  },
  {
    label: "Ease in bounce",
    value: "easeInBounce"
  },
  {
    label: "Ease out bounce",
    value: "easeOutBounce"
  },
  {
    label: "Ease in/out bounce",
    value: "easeInOutBounce"
  }
];

export const formValues = {
  timeScale: 2.2,
  path: {
    boundary: 147,
    step: 1 / 250,
    anchorTimeScale: 0.25,
    easing: "linear"
  },
  foreground: {
    sides: 2,
    flowerPetals: 5,
    sizeMin: 99,
    sizeMax: 293,
    borderColor: "#000000",
    fillColor: "#ffffff",
    borderWidth: 3,
    rotationSpeed: 0.39,
    innerRotationGain: 9.8
  },
  backgroundColor: [
    255,
    255,
    255,
    255
  ],
  title: {
    ...titleDefaultValues,
    show: false
  }
};

export const formConfiguration: Record<string, any> = {
  timeScale: {
    label: "Time scale",
    component: "slider",
    min: 0,
    max: 5,
    step: 0.01
  },
  path: {
    component: "nested-object",
    label: "Path (eased 3 anchors)",
    fields: {
      boundary: {
        label: "Boundary px",
        component: "slider",
        min: 0,
        max: 600,
        step: 1
      },
      step: {
        label: "Step (smaller = denser)",
        component: "slider",
        min: 0.0005,
        max: 0.05,
        step: 0.0005
      },
      anchorTimeScale: {
        label: "Anchor cycle speed",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      easing: {
        label: "Anchor easing",
        component: "select",
        options: EASING_OPTIONS
      }
    }
  },
  foreground: {
    component: "nested-object",
    label: "Foreground flowers",
    fields: {
      sides: {
        label: "Outer polygon sides",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      flowerPetals: {
        label: "Inner flower petals",
        component: "slider",
        min: 3,
        max: 24,
        step: 1
      },
      sizeMin: {
        label: "Size min",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      sizeMax: {
        label: "Size max",
        component: "slider",
        min: 10,
        max: 1500,
        step: 1
      },
      borderColor: {
        label: "Border color",
        component: "color"
      },
      fillColor: {
        label: "Fill color",
        component: "color"
      },
      borderWidth: {
        label: "Border width",
        component: "slider",
        min: 0,
        max: 60,
        step: 0.5
      },
      rotationSpeed: {
        label: "Rotation speed",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      innerRotationGain: {
        label: "Inner rotation gain",
        component: "slider",
        min: 0,
        max: 30,
        step: 0.1
      }
    }
  },
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
