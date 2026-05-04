import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
export const formValues = {
  grid: {
    gap: 3,
    depth: 10,
    columns: 36
  },
  animation: {
    useMouse: false,
    useHands: true,
    showSpheres: true,
    spheresCount: 6,
    sphereSize: 30,
    maxInfluenceDistance: 150,
    easing: "easeOutBack"
  },
  title: titleDefaultValues,
  color: {
    opacityFactor: 1.5,
    fillAlphaStart: 230,
    fillAlphaEnd: 20,
    strokeAlpha: 200,
    hueMultiplier: 2
  },
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      gap: {
        label: "Gap",
        component: "slider",
        min: 1,
        max: 500,
        step: 0.5
      },
      depth: {
        label: "Depth",
        component: "slider",
        min: 1,
        max: 500
      },
      columns: {
        label: "Grid columns",
        component: "slider",
        min: 10,
        max: 300
      }
    }
  },
  animation: {
    component: "nested-object",
    label: "Animation",
    fields: {
      useMouse: {
        label: "Use mouse",
        component: "checkbox"
      },
      useHands: {
        label: "Use hands",
        component: "checkbox"
      },
      showSpheres: {
        label: "Show spheres",
        component: "checkbox"
      },
      spheresCount: {
        label: "Spheres count",
        component: "slider",
        min: 0,
        max: 24
      },
      sphereSize: {
        label: "Sphere size",
        component: "slider",
        min: 1,
        max: 100
      },
      maxInfluenceDistance: {
        label: "Max influence distance",
        component: "slider",
        min: 0,
        max: 500,
        step: 0.5
      },
      easing: {
        component: "easing",
        label: "Depth easing"
      }
    }
  },
  color: {
    component: "nested-object",
    label: "Color",
    fields: {
      opacityFactor: {
        label: "Opacity factor",
        component: "slider",
        min: 0.1,
        max: 3,
        step: 0.1
      },
      fillAlphaStart: {
        label: "Fill alpha (visible)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      fillAlphaEnd: {
        label: "Fill alpha (hidden)",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      strokeAlpha: {
        label: "Stroke alpha",
        component: "slider",
        min: 0,
        max: 255,
        step: 1
      },
      hueMultiplier: {
        label: "Hue range multiplier",
        component: "slider",
        min: 0.5,
        max: 5,
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
