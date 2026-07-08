import {
  createFixedOrVariableOption, createSingleOrMultipleTextOption
} from "@/utils/sketchOptionUtils";
import {
  fontNames
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import getTestImagePaths from "@/utils/getTestImagePaths";

export const formValues = {
  strokeWeight: {
    mode: "fixed",
    value: 100
  },

  text: {
    mode: "single",
    value: "abc.xyz"
  },
  textStyle: {
    font: "waverseVariable",
    size: 1,
    sampleFactor: 0.0625,
    simplifyThreshold: 0
  },

  switchSpeed: 1,
  switchEasing: "linear",

  images: await getTestImagePaths(),
  imageStyle: {
    fill: true,
    clip: true,
    center: true,
    scale: 1,
    margin: 0
  },

  backgroundColor: [
    246,
    235,
    225
  ]
};

export const formConfiguration: Record<string, any> = {
  strokeWeight: createFixedOrVariableOption(
    "strokeWeight",
    {
      min: 0,
      max: 250,
      step: 0.1
    }
  ),

  text: createSingleOrMultipleTextOption( "text" ),

  textStyle: {
    component: "nested-object",
    label: "Text style",
    fields: {
      font: {
        component: "select",
        label: "Font name",
        options: fontNames.map( ( fontName ) => ( {
          value: fontName,
          label: fontName
        } ) )
      },
      size: {
        label: "Size",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      sampleFactor: {
        label: "Text sample factor",
        component: "slider",
        min: 0.01,
        max: 1,
        step: 0.01
      },
      simplifyThreshold: {
        label: "Simplify threshold",
        component: "slider",
        min: 0,
        max: 10,
        step: 0.1
      }
    }
  },

  images: {
    component: "images-stack",
    label: "Images"
  },

  imageStyle: {
    label: "Image style",
    component: "nested-object",
    fields: {
      margin: {
        label: "Image margin",
        component: "slider",
        min: 0,
        max: 0.45,
        step: 0.005
      },
      scale: {
        label: "Scale",
        component: "slider",
        min: 0.1,
        max: 4,
        step: 0.1
      },
      center: {
        label: "Center image",
        component: "checkbox"
      },
      clip: {
        label: "Clip",
        component: "checkbox"
      },
      fill: {
        label: "Fill",
        component: "checkbox"
      }
    }
  },

  backgroundColor: {
    component: "color",
    label: "Background color"
  }
};
