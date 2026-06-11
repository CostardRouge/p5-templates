import {
  getTestVideoPath
} from "@/utils/getTestVideoPaths";

// Default values only
export const formValues = {
  videos: [
    {
      id: "test-photos-zoom",
      path: await getTestVideoPath( "photos-zoom" ),
      params: {
        repeat: 1,
        speed: 1,
        offset: 0,
        loopMode: "loop",
        scale: 1,
        posX: 0,
        posY: 0,
        fit: "cover"
      }
    }
  ],

  cellSize: 8,
  glyph: "dot",
  colorMode: "mono",
  monoColor: [
    235,
    235,
    240
  ],
  dotScale: 0.6,
  invert: false,

  backgroundColor: [
    10,
    10,
    12
  ]
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  videos: {
    component: "asset-stack",
    kind: "videos",
    label: "Videos"
  },

  cellSize: {
    component: "slider",
    label: "Cell size (px)",
    min: 4,
    max: 64,
    step: 1
  },

  glyph: {
    component: "select",
    label: "Glyph",
    options: [
      {
        label: "Dot",
        value: "dot"
      },
      {
        label: "Square",
        value: "square"
      },
      {
        label: "ASCII",
        value: "ascii"
      }
    ]
  },

  colorMode: {
    component: "select",
    label: "Color mode",
    options: [
      {
        label: "Mono",
        value: "mono"
      },
      {
        label: "From video",
        value: "from-video"
      }
    ]
  },

  monoColor: {
    component: "color",
    label: "Glyph color (mono)"
  },

  dotScale: {
    component: "slider",
    label: "Glyph size",
    min: 0.2,
    max: 1.5,
    step: 0.05
  },

  invert: {
    component: "checkbox",
    label: "Invert"
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
