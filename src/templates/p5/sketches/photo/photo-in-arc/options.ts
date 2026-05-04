import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  images: [],

  backgroundColor: [
    246,
    235,
    225
  ],

  title: titleDefaultValues,

  arc: {
    anchorX: 0.5,
    anchorY: 0.75,
    radiusX: 0.5,
    radiusY: 0.5,
    startAngle: 270,
    endAngle: 90
  },

  image: {
    scale: 0.5,
    center: true
  },

  debug: {
    showPoints: false,
    pointWeight: 20,
    pointColor: [
      255,
      0,
      0
    ]
  }
};

export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  arc: {
    label: "Arc layout",
    component: "nested-object",
    fields: {
      anchorX: {
        component: "slider",
        label: "Anchor X (0–1)",
        min: 0,
        max: 1,
        step: 0.01
      },
      anchorY: {
        component: "slider",
        label: "Anchor Y (0–1)",
        min: 0,
        max: 1,
        step: 0.01
      },
      radiusX: {
        component: "slider",
        label: "Radius X (vs height)",
        min: 0,
        max: 1,
        step: 0.01
      },
      radiusY: {
        component: "slider",
        label: "Radius Y (vs width)",
        min: 0,
        max: 1,
        step: 0.01
      },
      startAngle: {
        component: "slider",
        label: "Start angle (deg)",
        min: -720,
        max: 720,
        step: 1
      },
      endAngle: {
        component: "slider",
        label: "End angle (deg)",
        min: -720,
        max: 720,
        step: 1
      }
    }
  },

  image: {
    label: "Image",
    component: "nested-object",
    fields: {
      scale: {
        component: "slider",
        label: "Scale",
        min: 0.05,
        max: 2,
        step: 0.01
      },
      center: {
        component: "checkbox",
        label: "Center"
      }
    }
  },

  debug: {
    label: "Debug",
    component: "nested-object",
    fields: {
      showPoints: {
        component: "checkbox",
        label: "Show points"
      },
      pointWeight: {
        component: "slider",
        label: "Point weight",
        min: 1,
        max: 40,
        step: 1
      },
      pointColor: {
        component: "color",
        label: "Point color"
      }
    }
  },

  title: titleFormConfiguration
};
