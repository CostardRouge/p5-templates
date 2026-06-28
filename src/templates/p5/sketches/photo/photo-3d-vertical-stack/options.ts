import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";
import titleDefaultValues from "@/p5/utils/title/titleDefaultValues";
import titleFormConfiguration from "@/p5/utils/title/titleFormConfiguration";
import getTestImagePaths from "@/utils/getTestImagePaths";

// Default values only
export const formValues = {
  // Assets
  images: await getTestImagePaths(),

  // Where the cards sit and how big they are
  layout: {
    shape: "tower",
    count: 12,
    radius: 290,
    turns: 0.25,
    depth: 2170,
    rise: 3000,
    waves: 1,
    amplitude: 0,
    photoSize: 0.6,
    photoShape: "auto",
    zoom: -1810
  },

  // How the stack scrolls and rotates
  motion: {
    scrollSpeed: 1,
    direction: "down",
    spin: 1,
    sway: 0.12,
    tilt: -0.42,
    cardSpin: -0.4,
    easing: "linear"
  },

  // Look & feel
  style: {
    photoFrame: true,
    frameColor: [
      245,
      245,
      245,
      255
    ],
    frameThickness: 0.065,
    fadeDepth: 0,
    fadeEdges: true,
    backgroundColor: [
      14,
      14,
      18
    ],
    variableBackgroundColor: false
  },

  // EXIF read-out for the front photo
  info: {
    show: true,
    placement: "bottom",
    showFilename: false,
    size: 22,
    color: [
      235,
      235,
      235
    ],
    font: "martian"
  },

  // Loop
  animation: {
    duration: 10,
    framerate: 37
  },

  title: titleDefaultValues
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },

  layout: {
    label: "Layout",
    component: "nested-object",
    fields: {
      shape: {
        label: "Path shape",
        component: "select",
        options: [
          {
            label: "Helix (spiral)",
            value: "helix"
          },
          {
            label: "Tower (receding deck)",
            value: "tower"
          },
          {
            label: "Carousel (ring)",
            value: "carousel"
          },
          {
            label: "Tunnel (into screen)",
            value: "tunnel"
          },
          {
            label: "Wave (ribbon)",
            value: "wave"
          }
        ]
      },
      count: {
        label: "Card count (0 = one per photo)",
        component: "slider",
        min: 0,
        max: 200,
        step: 1
      },
      radius: {
        label: "Orbit radius (helix / carousel / wave)",
        component: "slider",
        min: 0,
        max: 900,
        step: 10
      },
      turns: {
        label: "Helix turns",
        component: "slider",
        min: 0.25,
        max: 6,
        step: 0.05
      },
      depth: {
        label: "Depth (Z spread)",
        component: "slider",
        min: 100,
        max: 3000,
        step: 10
      },
      rise: {
        label: "Vertical travel",
        component: "slider",
        min: 200,
        max: 3000,
        step: 10
      },
      waves: {
        label: "Wave count",
        component: "slider",
        min: 1,
        max: 8,
        step: 1
      },
      amplitude: {
        label: "Wave amplitude",
        component: "slider",
        min: 0,
        max: 900,
        step: 10
      },
      photoSize: {
        label: "Photo size",
        component: "slider",
        min: 0.1,
        max: 1.5,
        step: 0.01
      },
      photoShape: {
        label: "Photo shape",
        component: "select",
        options: [
          {
            label: "Auto (canvas)",
            value: "auto"
          },
          {
            label: "Portrait",
            value: "portrait"
          },
          {
            label: "Square",
            value: "square"
          },
          {
            label: "Landscape",
            value: "landscape"
          }
        ]
      },
      zoom: {
        label: "Zoom (Z translate)",
        component: "slider",
        min: -5000,
        max: 0,
        step: 10
      }
    }
  },

  motion: {
    label: "Motion",
    component: "nested-object",
    fields: {
      scrollSpeed: {
        label: "Scroll cycles per loop",
        component: "slider",
        min: 0,
        max: 6,
        step: 1
      },
      direction: {
        label: "Scroll direction",
        component: "select",
        options: [
          {
            label: "Down",
            value: "down"
          },
          {
            label: "Up",
            value: "up"
          }
        ]
      },
      spin: {
        label: "Turntable turns per loop",
        component: "slider",
        min: -3,
        max: 3,
        step: 1
      },
      sway: {
        label: "Pendulum sway",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      tilt: {
        label: "Camera tilt",
        component: "slider",
        min: -1,
        max: 1,
        step: 0.01
      },
      cardSpin: {
        label: "Per-card roll (turns per loop)",
        component: "slider",
        min: -2,
        max: 2,
        step: 0.05
      },
      easing: {
        label: "Scroll easing",
        component: "easing"
      }
    }
  },

  style: {
    label: "Style",
    component: "nested-object",
    fields: {
      photoFrame: {
        label: "Photo frame",
        component: "checkbox"
      },
      frameColor: {
        label: "Frame color",
        component: "color"
      },
      frameThickness: {
        label: "Frame thickness",
        component: "slider",
        min: 0,
        max: 0.2,
        step: 0.005
      },
      fadeDepth: {
        label: "Dim distant cards",
        component: "slider",
        min: 0,
        max: 1,
        step: 0.01
      },
      fadeEdges: {
        label: "Fade cards on recycle",
        component: "checkbox"
      },
      backgroundColor: {
        label: "Background color",
        component: "color"
      },
      variableBackgroundColor: {
        label: "Animated background color",
        component: "checkbox"
      }
    }
  },

  info: {
    label: "EXIF read-out",
    component: "nested-object",
    fields: {
      show: {
        label: "Show EXIF",
        component: "checkbox"
      },
      placement: {
        label: "Placement",
        component: "select",
        options: [
          {
            label: "Left",
            value: "left"
          },
          {
            label: "Right",
            value: "right"
          },
          {
            label: "Bottom",
            value: "bottom"
          },
          {
            label: "Top",
            value: "top"
          }
        ]
      },
      showFilename: {
        label: "Include filename",
        component: "checkbox"
      },
      size: {
        label: "Text size",
        component: "slider",
        min: 10,
        max: 64,
        step: 1
      },
      color: {
        label: "Text color",
        component: "color"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      }
    }
  },

  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      duration: {
        label: "Duration (seconds)",
        component: "slider",
        min: 1,
        max: 60,
        step: 0.5
      },
      framerate: {
        label: "Framerate",
        component: "slider",
        min: 1,
        max: 120,
        step: 1
      }
    }
  },

  title: titleFormConfiguration
};
