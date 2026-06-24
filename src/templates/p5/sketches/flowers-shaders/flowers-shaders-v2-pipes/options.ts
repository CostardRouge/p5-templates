import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";

export const formValues = {
  timeScale: 1,
  braid: {
    pipeCount: 3,
    pipeRadius: 0.28,
    braidRadius: 0.85,
    twist: 2.2,
    spin: 0.6,
    radiusPulse: 0.18,
    pulseFreq: 0.8,
    pulseSpeed: 1
  },
  camera: {
    distance: 4.2,
    fov: 45,
    pitch: 0.18,
    yaw: 0.5,
    orbitSpeed: 0.15,
    fogDensity: 0.14
  },
  colors: {
    hueSpeed: 0.05,
    hueSpread: 1.4,
    huePhase: 0,
    lengthHueShift: 0.2,
    pipeHueShift: 0.33,
    shimmer: 0.6,
    saturation: 1,
    brightness: 1.3
  },
  light: {
    azimuth: -0.6,
    elevation: 0.8,
    ambient: 0.18,
    diffuse: 0.9,
    specular: 0.5,
    specPower: 40,
    fresnelPower: 2.5,
    rimStrength: 0.7
  },
  aberration: {
    amount: 0,
    mode: "radial" as "radial" | "horizontal"
  },
  backgroundColor: [
    0,
    0,
    0
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
  braid: {
    component: "nested-object",
    label: "Braid (3D pipes)",
    fields: {
      pipeCount: {
        label: "Pipes",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      pipeRadius: {
        label: "Pipe radius",
        component: "slider",
        min: 0.05,
        max: 0.8,
        step: 0.01
      },
      braidRadius: {
        label: "Braid radius (orbit)",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      twist: {
        label: "Twist (winding)",
        component: "slider",
        min: 0,
        max: 8,
        step: 0.01
      },
      spin: {
        label: "Spin speed",
        component: "slider",
        min: -3,
        max: 3,
        step: 0.01
      },
      radiusPulse: {
        label: "Radius pulse",
        component: "slider",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      pulseFreq: {
        label: "Pulse frequency",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      },
      pulseSpeed: {
        label: "Pulse speed",
        component: "slider",
        min: 0,
        max: 4,
        step: 0.01
      }
    }
  },
  camera: {
    component: "nested-object",
    label: "Camera",
    fields: {
      distance: {
        label: "Distance",
        component: "slider",
        min: 1.5,
        max: 10,
        step: 0.05
      },
      fov: {
        label: "Field of view °",
        component: "slider",
        min: 20,
        max: 90,
        step: 1
      },
      pitch: {
        label: "Pitch (elevation)",
        component: "slider",
        min: -1.2,
        max: 1.2,
        step: 0.01
      },
      yaw: {
        label: "Yaw (base orbit)",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      orbitSpeed: {
        label: "Orbit speed",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      fogDensity: {
        label: "Fog density",
        component: "slider",
        min: 0,
        max: 0.6,
        step: 0.005
      }
    }
  },
  colors: {
    component: "nested-object",
    label: "Iridescent",
    fields: {
      hueSpeed: {
        label: "Hue speed",
        component: "slider",
        min: -5,
        max: 5,
        step: 0.01
      },
      hueSpread: {
        label: "Hue spread",
        component: "slider",
        min: 0.1,
        max: 6,
        step: 0.01
      },
      huePhase: {
        label: "Hue phase",
        component: "slider",
        min: 0,
        max: 6.2832,
        step: 0.01
      },
      lengthHueShift: {
        label: "Length hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      pipeHueShift: {
        label: "Pipe hue shift",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.01
      },
      shimmer: {
        label: "Shimmer (oil-slick)",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      },
      saturation: {
        label: "Saturation",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      brightness: {
        label: "Brightness",
        component: "slider",
        min: 0,
        max: 3,
        step: 0.01
      }
    }
  },
  light: {
    component: "nested-object",
    label: "Lighting",
    fields: {
      azimuth: {
        label: "Light azimuth",
        component: "slider",
        min: -3.1416,
        max: 3.1416,
        step: 0.01
      },
      elevation: {
        label: "Light elevation",
        component: "slider",
        min: -1.5708,
        max: 1.5708,
        step: 0.01
      },
      ambient: {
        label: "Ambient",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      diffuse: {
        label: "Diffuse",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      specular: {
        label: "Specular",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      },
      specPower: {
        label: "Specular sharpness",
        component: "slider",
        min: 1,
        max: 128,
        step: 1
      },
      fresnelPower: {
        label: "Fresnel power",
        component: "slider",
        min: 0.5,
        max: 6,
        step: 0.01
      },
      rimStrength: {
        label: "Rim glow",
        component: "slider",
        min: 0,
        max: 2,
        step: 0.01
      }
    }
  },
  aberration: {
    component: "nested-object",
    label: "Chromatic aberration",
    fields: {
      amount: {
        label: "Amount px (0 = off)",
        component: "slider",
        min: 0,
        max: 40,
        step: 0.5
      },
      mode: {
        label: "Direction",
        component: "select",
        options: [
          {
            label: "Radial",
            value: "radial"
          },
          {
            label: "Horizontal",
            value: "horizontal"
          }
        ]
      }
    }
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  title: titleFormConfiguration
};
