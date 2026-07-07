import {
  WAVEFORM_NAMES
} from "./waveforms.js";

/**
 * Standard "oscillation" configuration for form options — drop into any
 * sketch's formConfiguration next to its `oscillationDefaultValues`:
 *
 *   import oscillationDefaultValues
 *     from "@/p5/utils/oscillator/oscillatorDefaultValues";
 *   import oscillationFormConfiguration
 *     from "@/p5/utils/oscillator/oscillatorFormConfiguration";
 */

const waveformLabels = {
  wave: "Wave (ramp)",
  sine: "Sine (smooth)",
  triangle: "Triangle (ping-pong)",
  square: "Square (toggle)"
};

const oscillationFormConfiguration = {
  label: "Oscillation",
  component: "nested-object",
  fields: {
    waveform: {
      label: "Waveform",
      component: "select",
      options: WAVEFORM_NAMES.map( ( name ) => ( {
        value: name,
        label: waveformLabels[ name ] ?? name
      } ) )
    },
    cycles: {
      label: "Cycles",
      component: "slider",
      min: 1,
      max: 9,
      step: 1
    },
    offset: {
      label: "Phase offset",
      component: "slider",
      min: 0,
      max: 1,
      step: 0.01
    },
    amplitude: {
      label: "Amplitude",
      component: "slider",
      min: 0,
      max: 2,
      step: 0.05
    }
  }
};

export default oscillationFormConfiguration;
