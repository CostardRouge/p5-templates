import titleDefaultValues from "@/p5/utils/title/titleDefaultValues.js";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration.js";
import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  photo: ( await getTestImagePaths() )[ 2 ],
  point: {
    x: 0.5,
    y: 0.5
  },

  zoom: {
    count: 1,
    easing: "easeInOutExpo",
    minZoomScale: 1,
    maxZoomScale: 5
  },

  circle: {
    draw: true,
    stroke: [
      255,
      255,
      255
    ],
    strokeWeight: 3,
    radius: 30
  },

  imageSettings: {
    margin: 0.1,
    scale: 1,
    center: true,
    clip: false,
    fill: false
  },

  backgroundColor: [
    246,
    235,
    225
  ],

  title: titleDefaultValues
};

export const formConfiguration: Record<string, any> = {
  photo: {
    component: "image",
    label: "Photo"
  },

  point: {
    component: "nested-object",
    label: "Point",
    fields: {
      x: {
        component: "slider",
        label: "X",
        min: 0,
        max: 1,
        step: 0.01
      },
      y: {
        component: "slider",
        label: "Y",
        min: 0,
        max: 1,
        step: 0.01
      }
    }
  },

  zoom: {
    label: "Zoom",
    component: "nested-object",
    fields: {
      count: {
        label: "Count",
        component: "slider",
        min: 0,
        max: 10
      },
      minZoomScale: {
        label: "Start scale",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      maxZoomScale: {
        label: "End scale",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      easing: {
        component: "easing",
        label: "Easing"
      }
    }
  },
  imageSettings: {
    label: "Image settings",
    component: "nested-object",
    fields: {
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005
      },
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      center: {
        label: "Center image",
        component: "checkbox"
      },
      clip: {
        label: "Clip",
        component: "checkbox"
      },
      fill: {
        label: "Fill",
        component: "checkbox"
      }
    }
  },

  circle: {
    label: "Circle",
    component: "nested-object",
    fields: {
      draw: {
        label: "Draw circle?",
        component: "checkbox"
      },
      stroke: {
        label: "Stroke",
        component: "color"
      },
      strokeWeight: {
        label: "Stroke weight",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      },
      radius: {
        label: "Radius",
        component: "slider",
        min: 0,
        max: 100
      }
    }
  },

  title: titleFormConfiguration,

  // Colors
  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
