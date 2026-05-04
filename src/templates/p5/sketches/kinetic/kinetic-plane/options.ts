import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
export const formValues = {
  texture: {
    image: null,
    useWebcam: false
  },
  grid: {
    columns: 20,
    rows: 30,
    stroke: {
      color: [
        0
      ],
      hide: false
    }
  },
  animation: {
    useMouse: false,
    useHands: false,
    showWebcam: false,
    showSpheres: false,
    spheresCount: 6,
    sphereSize: 30,
    depth: 100,
    maxInfluenceDistance: 150,
    easing: "easeOutBack"
  },
  title: titleDefaultValues,
  backgroundColor: [
    246,
    235,
    225
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  texture: {
    component: "nested-object",
    label: "Texture",
    fields: {
      image: {
        component: "image",
        label: "Image"
      },
      useWebcam: {
        label: "Use webcam as texture",
        component: "checkbox"
      }
    }
  },
  grid: {
    component: "nested-object",
    label: "Grid",
    fields: {
      columns: {
        label: "Grid columns",
        component: "slider",
        min: 1,
        max: 100
      },
      rows: {
        label: "Grid rows",
        component: "slider",
        min: 1,
        max: 100
      },
      stroke: {
        component: "nested-object",
        label: "Stroke",
        fields: {
          color: {
            component: "color",
            label: "stroke"
          },
          hide: {
            label: "noStroke()",
            component: "checkbox"
          }
        }
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
      showWebcam: {
        label: "Show webcam",
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
      depth: {
        label: "Depth",
        component: "slider",
        min: 1,
        max: 500
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
  title: titleFormConfiguration,
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
