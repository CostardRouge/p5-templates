// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  // Background
  backgroundColor: [
    246,
    235,
    225
  ],

  // Physics playground
  physics: {
    ballCount: 26,
    ballSizeMin: 50,
    ballSizeMax: 80,
    handRadius: 75,
    // A gentle ambient drift. Keep at 0/0 for the classic floaty look, or nudge
    // it to make the dots slowly fall, rise or pour to one side.
    gravity: {
      x: 0,
      y: 0
    }
  },

  // Neon look
  visuals: {
    shadowsCount: 3,
    dotScale: 1,
    // Lower = longer light trails (less is erased each frame).
    trail: 10
  },

  // Overlay text
  text: {
    show: true,
    title: "move",
    subtitle: "hand tracking v0"
  }
};

// UI configuration only
export const formConfiguration: Record<string, any> = {
  backgroundColor: {
    component: "color",
    label: "Background color"
  },

  physics: {
    component: "nested-object",
    label: "Physics",
    initialExpanded: true,
    fields: {
      ballCount: {
        label: "Ball count",
        component: "slider",
        min: 1,
        max: 200,
        step: 1
      },
      ballSizeMin: {
        label: "Ball size (min)",
        component: "slider",
        min: 5,
        max: 200,
        step: 1
      },
      ballSizeMax: {
        label: "Ball size (max)",
        component: "slider",
        min: 5,
        max: 300,
        step: 1
      },
      handRadius: {
        label: "Hand touch radius",
        component: "slider",
        min: 10,
        max: 250,
        step: 1
      },
      gravity: {
        label: "Ambient drift",
        component: "vector2d",
        min: -1,
        max: 1,
        step: 0.01,
        yDown: true
      }
    }
  },

  visuals: {
    component: "nested-object",
    label: "Neon visuals",
    fields: {
      shadowsCount: {
        label: "Glow layers",
        component: "slider",
        min: 1,
        max: 12,
        step: 1
      },
      dotScale: {
        label: "Dot scale",
        component: "slider",
        min: 0.2,
        max: 3,
        step: 0.05
      },
      trail: {
        label: "Trail fade (lower = longer)",
        component: "slider",
        min: 1,
        max: 255,
        step: 1
      }
    }
  },

  text: {
    component: "nested-object",
    label: "Overlay text",
    fields: {
      show: {
        label: "Show text",
        component: "checkbox"
      },
      title: {
        label: "Title",
        component: "text"
      },
      subtitle: {
        label: "Subtitle",
        component: "text"
      }
    }
  }
};
