import {
  getCommonPhotoValues,
  commonPhotoConfig
} from "@/gsap/utils/photoOptions";

/**
 * Photo EXIF — an editorial "spec sheet" that presents a single photograph
 * alongside the camera settings it was shot with (ISO, shutter speed,
 * aperture, focal length, lens and the friendly camera name), read straight
 * from the file's EXIF metadata.
 *
 * Everything is adjustable: three editorial layouts, a typographic system,
 * which specs are shown, a parametrable metadata reveal and a slow Ken Burns
 * drift on the photo — so it loops seamlessly like the other templates.
 */
export const formValues = {
  ...( await getCommonPhotoValues() ),

  backgroundColor: [
    16,
    16,
    18
  ],
  shadow: {
    enabled: false,
    blur: 40,
    opacity: 0.35,
    y: 24
  },

  maxImages: 24,
  layout: "editorial",
  margin: 80,

  textColor: [
    237,
    234,
    226,
    255
  ],
  labelColor: [
    146,
    146,
    152,
    255
  ],
  accentColor: [
    216,
    92,
    58,
    255
  ],

  typography: {
    displayFamily: "serif",
    valueFamily: "mono",
    uppercaseLabels: true,
    letterSpacing: 0.14,
    sizeScale: 1
  },

  frame: {
    showBorder: false,
    borderColor: [
      72,
      72,
      78
    ],
    borderWidth: 3
  },

  show: {
    camera: true,
    date: true,
    focal: true,
    aperture: true,
    shutter: true,
    iso: true,
    lens: true,
    gps: false,
    filename: false
  },

  caption: "",
  credit: "",
  cameraOverride: "",

  reveal: {
    enabled: true,
    style: "fade",
    distance: 90,
    hold: 0.34,
    stagger: 0.29
  },

  transition: {
    enabled: true,
    style: "fade",
    direction: "up",
    portion: 0.3
  },

  photoMotion: {
    enabled: false,
    zoom: 0.05,
    panX: 0.03,
    panY: -0.02
  }
};

export const formConfiguration: Record<string, any> = {
  ...commonPhotoConfig,

  maxImages: {
    component: "slider",
    label: "Max images",
    min: 1,
    max: 60,
    step: 1
  },
  layout: {
    component: "select",
    label: "Layout",
    options: [
      {
        label: "Editorial (paper)",
        value: "editorial"
      },
      {
        label: "Overlay (on photo)",
        value: "overlay"
      },
      {
        label: "Minimal (corner)",
        value: "minimal"
      }
    ]
  },
  margin: {
    component: "slider",
    label: "Margin",
    min: 0,
    max: 320,
    step: 1
  },
  textColor: {
    component: "color",
    label: "Text color"
  },
  labelColor: {
    component: "color",
    label: "Label color"
  },
  accentColor: {
    component: "color",
    label: "Accent color"
  },
  typography: {
    component: "nested-object",
    label: "Typography",
    fields: {
      displayFamily: {
        component: "select",
        label: "Display family",
        options: [
          {
            label: "Serif",
            value: "serif"
          },
          {
            label: "Sans",
            value: "sans"
          },
          {
            label: "Mono",
            value: "mono"
          }
        ]
      },
      valueFamily: {
        component: "select",
        label: "Value family",
        options: [
          {
            label: "Mono",
            value: "mono"
          },
          {
            label: "Sans",
            value: "sans"
          },
          {
            label: "Serif",
            value: "serif"
          }
        ]
      },
      uppercaseLabels: {
        component: "checkbox",
        label: "Uppercase labels"
      },
      letterSpacing: {
        component: "slider",
        label: "Label tracking",
        min: 0,
        max: 0.5,
        step: 0.01
      },
      sizeScale: {
        component: "slider",
        label: "Text scale",
        min: 0.5,
        max: 2,
        step: 0.05
      }
    }
  },
  frame: {
    component: "nested-object",
    label: "Photo frame",
    fields: {
      showBorder: {
        component: "checkbox",
        label: "Show border"
      },
      borderColor: {
        component: "color",
        label: "Border color"
      },
      borderWidth: {
        component: "slider",
        label: "Border width",
        min: 0,
        max: 24,
        step: 1
      }
    }
  },
  show: {
    component: "nested-object",
    label: "Visible specs",
    fields: {
      camera: {
        component: "checkbox",
        label: "Camera"
      },
      date: {
        component: "checkbox",
        label: "Date"
      },
      focal: {
        component: "checkbox",
        label: "Focal length"
      },
      aperture: {
        component: "checkbox",
        label: "Aperture"
      },
      shutter: {
        component: "checkbox",
        label: "Shutter speed"
      },
      iso: {
        component: "checkbox",
        label: "ISO"
      },
      lens: {
        component: "checkbox",
        label: "Lens"
      },
      gps: {
        component: "checkbox",
        label: "Coordinates"
      },
      filename: {
        component: "checkbox",
        label: "Filename"
      }
    }
  },
  caption: {
    component: "text",
    label: "Caption"
  },
  credit: {
    component: "text",
    label: "Credit"
  },
  cameraOverride: {
    component: "text",
    label: "Camera name override"
  },
  reveal: {
    component: "nested-object",
    label: "Metadata reveal",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Enabled"
      },
      style: {
        component: "select",
        label: "Style",
        options: [
          {
            label: "Rise",
            value: "rise"
          },
          {
            label: "Fall",
            value: "fall"
          },
          {
            label: "Slide left",
            value: "left"
          },
          {
            label: "Slide right",
            value: "right"
          },
          {
            label: "Fade",
            value: "fade"
          },
          {
            label: "Scale",
            value: "scale"
          },
          {
            label: "Wipe",
            value: "wipe"
          },
          {
            label: "Blur",
            value: "blur"
          }
        ]
      },
      distance: {
        component: "slider",
        label: "Distance",
        min: 0,
        max: 200,
        step: 1
      },
      hold: {
        component: "slider",
        label: "Hold (per image)",
        min: 0,
        max: 0.9,
        step: 0.01
      },
      stagger: {
        component: "slider",
        label: "Stagger",
        min: 0,
        max: 0.6,
        step: 0.01
      }
    }
  },
  transition: {
    component: "nested-object",
    label: "Image transition",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Animated (off = hard cut)"
      },
      style: {
        component: "select",
        label: "Style",
        options: [
          {
            label: "Fade",
            value: "fade"
          },
          {
            label: "Zoom",
            value: "zoom"
          },
          {
            label: "Slide",
            value: "slide"
          },
          {
            label: "Wipe",
            value: "wipe"
          }
        ]
      },
      direction: {
        component: "select",
        label: "Direction (slide / wipe)",
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
            label: "Up",
            value: "up"
          },
          {
            label: "Down",
            value: "down"
          }
        ]
      },
      portion: {
        component: "slider",
        label: "Crossfade length",
        min: 0.1,
        max: 0.6,
        step: 0.01
      }
    }
  },
  photoMotion: {
    component: "nested-object",
    label: "Photo motion",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Enabled"
      },
      zoom: {
        component: "slider",
        label: "Zoom",
        min: 0,
        max: 0.6,
        step: 0.01
      },
      panX: {
        component: "slider",
        label: "Pan X",
        min: -0.3,
        max: 0.3,
        step: 0.01
      },
      panY: {
        component: "slider",
        label: "Pan Y",
        min: -0.3,
        max: 0.3,
        step: 0.01
      }
    }
  }
};
