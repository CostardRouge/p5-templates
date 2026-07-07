import getTestVideoPaths from "@/utils/getTestVideoPaths";

// Default values only
export const formValues = {
  // Assets — each entry is { id, path, params: { repeat, speed, offset,
  // loopMode, scale, posX, posY, fit } }. In the grid, each video's
  // scale / position / fit apply *within its own cell*.
  videos: ( await getTestVideoPaths() ).map( (
    path, index
  ) => ( {
    id: `test-grid-${ index }`,
    path,
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
  } ) ),

  // Grid layout
  autoColumns: false,
  columns: 2,
  gap: 16,
  padding: 0,

  // Per-cell backdrop (helps letterboxed clips read as distinct tiles)
  showCellBackground: false,
  cellColor: [
    20,
    20,
    24
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

  autoColumns: {
    component: "checkbox",
    label: "Auto columns (fit to count)"
  },

  columns: {
    component: "slider",
    label: "Columns",
    min: 1,
    max: 12,
    step: 1
  },

  gap: {
    component: "slider",
    label: "Gap (px)",
    min: 0,
    max: 300,
    step: 1
  },

  padding: {
    component: "slider",
    label: "Outer padding (px)",
    min: 0,
    max: 500,
    step: 1
  },

  showCellBackground: {
    component: "checkbox",
    label: "Cell background"
  },

  cellColor: {
    component: "color",
    label: "Cell background color"
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
