/**
 * Shared option building-blocks for GSAP/HTML photo templates.
 *
 * Every photo template exposes the same rich common base — image selection,
 * fit, corner radius, gap, background, easing, colour grading and shadow — and
 * then layers its own template-specific controls on top. Keeping the base here
 * means a tweak to (say) the shadow controls updates every template at once.
 *
 * NOTE: this module is imported by `options.ts` files (loaded server-side) and
 * pulls in `getTestImagePaths` (which reads the filesystem), so it is kept out
 * of the client-facing `@/gsap/utils` barrel on purpose.
 */
import getTestImagePaths from "@/utils/getTestImagePaths";

/** Default values for the common photo option base. */
export async function getCommonPhotoValues() {
  return {
    images: await getTestImagePaths(),
    imageFit: "cover",
    cornerRadius: 16,
    gap: 16,
    backgroundColor: [
      10,
      10,
      12
    ],
    ease: "easeInOutCubic",
    imageEffect: {
      grayscale: 0,
      brightness: 1,
      contrast: 1,
      saturate: 1,
      blur: 0
    },
    shadow: {
      enabled: true,
      blur: 40,
      opacity: 0.35,
      y: 24
    }
  };
}

/** Form configuration for the common photo option base. */
export const commonPhotoConfig: Record<string, any> = {
  images: {
    component: "images-stack",
    label: "Images"
  },
  imageFit: {
    component: "select",
    label: "Image fit",
    options: [
      {
        label: "Cover",
        value: "cover"
      },
      {
        label: "Contain",
        value: "contain"
      }
    ]
  },
  cornerRadius: {
    component: "slider",
    label: "Corner radius",
    min: 0,
    max: 120,
    step: 1
  },
  gap: {
    component: "slider",
    label: "Gap",
    min: 0,
    max: 160,
    step: 1
  },
  backgroundColor: {
    component: "color",
    label: "Background color"
  },
  ease: {
    component: "easing",
    label: "Easing"
  },
  imageEffect: {
    component: "nested-object",
    label: "Image effect",
    fields: {
      grayscale: {
        component: "slider",
        label: "Grayscale",
        min: 0,
        max: 1,
        step: 0.01
      },
      brightness: {
        component: "slider",
        label: "Brightness",
        min: 0,
        max: 2,
        step: 0.01
      },
      contrast: {
        component: "slider",
        label: "Contrast",
        min: 0,
        max: 2,
        step: 0.01
      },
      saturate: {
        component: "slider",
        label: "Saturation",
        min: 0,
        max: 2,
        step: 0.01
      },
      blur: {
        component: "slider",
        label: "Blur",
        min: 0,
        max: 40,
        step: 0.5
      }
    }
  },
  shadow: {
    component: "nested-object",
    label: "Shadow",
    fields: {
      enabled: {
        component: "checkbox",
        label: "Enabled"
      },
      blur: {
        component: "slider",
        label: "Blur",
        min: 0,
        max: 160,
        step: 1
      },
      opacity: {
        component: "slider",
        label: "Opacity",
        min: 0,
        max: 1,
        step: 0.01
      },
      y: {
        component: "slider",
        label: "Offset Y",
        min: 0,
        max: 160,
        step: 1
      }
    }
  }
};
