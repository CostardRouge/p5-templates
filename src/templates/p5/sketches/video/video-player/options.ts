import {
  getTestVideoPath
} from "@/utils/getTestVideoPaths";

// Default values only
export const formValues = {
  // Assets — each entry is { id, path, params: { repeat, speed, offset,
  // loopMode, scale, posX, posY, fit } }
  videos: [
    {
      id: "test-photos-zoom",
      path: await getTestVideoPath( "photos-zoom" ),
      params: {
        repeat: 1,
        speed: 1,
        offset: 0,
        loopMode: "loop",
        scale: 0.9,
        posX: 0,
        posY: 0,
        fit: "contain"
      }
    }
  ],

  // Colors
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

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
