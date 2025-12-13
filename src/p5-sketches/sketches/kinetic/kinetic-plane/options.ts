import titleDefaultValues from "@/p5-sketches/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5-sketches/utils/title/titleFormConfiguration";
import easing from "@/p5/utils/easing";

export const formValues = {
  image: null,
  grid: {
    columns: 20,
    rows: 10,
  },
  animation: {
    useMouse: false,
    useHands: false,
    showSpheres: true,
    spheresCount: 6,
    sphereSize: 30,
    depth: 100,
    maxInfluenceDistance: 150,
    easing: "easeOutBack",
    showWebcam: false,
  },
  title: titleDefaultValues,
  backgroundColor: [
    246,
    235,
    225
  ],
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  image: {
    component: "image",
    label: "Image"
  },
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      columns: {
        label: "Grid columns",
        component: "slider",
        min: 1,
        max: 100,
      },
      rows: {
        label: "Grid rows",
        component: "slider",
        min: 1,
        max: 100,
      },
    }
  },
  animation: {
    component: "nested-object",
    label: "Animation",
    fields: {
      useMouse: {
        label: "Use mouse",
        component: "checkbox",
      },
      useHands: {
        label: "Use hands",
        component: "checkbox",
      },
      showWebcam: {
        label: "Show Webcam",
        component: "checkbox",
      },
      showSpheres: {
        label: "Show spheres",
        component: "checkbox",
      },
      spheresCount: {
        label: "Spheres count",
        component: "slider",
        min: 0,
        max: 24,
      },
      sphereSize: {
        label: "Sphere size",
        component: "slider",
        min: 1,
        max: 100,
      },
      depth: {
        label: "Depth",
        component: "slider",
        min: 1,
        max: 500,
      },
      maxInfluenceDistance: {
        label: "Max influence distance",
        component: "slider",
        min: 0,
        max: 500,
        step: 0.5
      },
      easing: {
        component: "select",
        label: "Depth easing",
        options: Object.keys( easing ).map( easingFunctionName => ( {
          label: easingFunctionName,
          value: easingFunctionName,
        } ) )
      },
    }
  },
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
};
