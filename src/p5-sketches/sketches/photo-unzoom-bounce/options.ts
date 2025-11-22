import {
  fontNames
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

export const formValues = {
  title: {
    content: "500",
    font: "cloitre"
  },

  colors: {
    text: [
      0,
      0,
      0
    ] as [number, number, number],
    background: [
      230,
      230,
      230
    ] as [number, number, number],
    accent: [
      128,
      128,
      255
    ] as [number, number, number]
  },

  animation: {
    duration: 12,
    framerate: 60
  },

  count: 200,
  lines: false,
  rotate: true
};

export const formConfiguration: Record<string, any> = {
  title: {
    label: "Title",
    component: "nested-object",
    fields: {
      content: {
        label: "Content",
        component: "text"
      },
      font: {
        label: "Font",
        component: "select",
        options: fontNames.map( fontName => ( {
          value: fontName,
          label: fontName
        } ) )
      }
    }
  },

  colors: {
    label: "Colors",
    component: "nested-object",
    fields: {
      text: {
        component: "color",
        label: "Text color"
      },
      background: {
        component: "color",
        label: "Background color"
      },
      accent: {
        component: "color",
        label: "Accent color"
      }
    }
  },

  animation: {
    label: "Animation",
    component: "nested-object",
    fields: {
      duration: {
        component: "slider",
        label: "Duration (seconds)",
        min: 1,
        max: 60,
        step: 0.5
      },
      framerate: {
        component: "slider",
        label: "Framerate",
        min: 1,
        max: 120,
        step: 1
      }
    }
  },

  count: {
    component: "slider",
    label: "Count",
    min: 10,
    max: 500,
    step: 10
  },

  lines: {
    component: "checkbox",
    label: "Show lines"
  },

  rotate: {
    component: "checkbox",
    label: "Rotate"
  }
};
