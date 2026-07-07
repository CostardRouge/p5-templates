// ── Shared camera source picker (form fragment) ─────────────────────────────
// Drop the same webcam picker the interaction/vision layer uses into any
// sketch's options. Import and spread into a sketch's options.ts:
//
//   import { webcamSourceFormValues, webcamSourceFormConfiguration }
//     from "@/p5/utils/webcam/defaults.js";
//
//   export const formValues = { camera: { ...webcamSourceFormValues }, ... };
//   export const formConfiguration = { camera: webcamSourceFormConfiguration, ... };
//
// The `deviceId` field is bound to the shared `webcam-device-select` control,
// so its option list (and "Default") behaves exactly like every other camera
// picker in the app. Pair it with the runtime capture util in `./index.js`.

export const webcamSourceFormValues = {
  deviceId: "",
  width: 1280,
  height: 720,
  flip: true
};

export const webcamSourceFormConfiguration = {
  component: "nested-object",
  label: "Camera",
  initialExpanded: true,
  fields: {
    deviceId: {
      component: "webcam-device-select",
      label: "Camera"
    },
    width: {
      component: "select",
      label: "Width",
      asNumber: true,
      options: [
        {
          label: "640",
          value: "640"
        },
        {
          label: "1280",
          value: "1280"
        },
        {
          label: "1920",
          value: "1920"
        }
      ]
    },
    height: {
      component: "select",
      label: "Height",
      asNumber: true,
      options: [
        {
          label: "480",
          value: "480"
        },
        {
          label: "720",
          value: "720"
        },
        {
          label: "1080",
          value: "1080"
        }
      ]
    },
    flip: {
      component: "checkbox",
      label: "Flip (mirror)",
      default: true
    }
  }
};
