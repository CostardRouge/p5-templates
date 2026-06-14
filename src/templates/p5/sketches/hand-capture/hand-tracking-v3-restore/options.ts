// Default values only — exposed at runtime as `options.sketch.*`
export const formValues = {
  physics: {
    ballCount: 50,
    ballSizeMin: 40,
    ballSizeMax: 60,
    handRadius: 75
  },

  // Springs that pull each dot back to its birthplace once the hands move on.
  restore: {
    strength: 0.01,
    maxForce: 0.003
  },

  visuals: {
    shadowsCount: 3,
    dotScale: 1
  },

  text: {
    show: true,
    title: "restore",
    subtitle: "hand tracking v3"
  }
};

export const formConfiguration: Record<string, any> = {
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
      }
    }
  },

  restore: {
    component: "nested-object",
    label: "Restoring spring",
    initialExpanded: true,
    fields: {
      strength: {
        label: "Spring stiffness",
        component: "slider",
        min: 0,
        max: 0.05,
        step: 0.001
      },
      maxForce: {
        label: "Max force (return speed cap)",
        component: "slider",
        min: 0.0005,
        max: 0.02,
        step: 0.0005
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
