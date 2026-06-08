import options from "../options.js";
import animation from "../animation.js";
import time from "../time.js";
import {
  getP5
} from "../sketch.js";
import probes from "./probes.js";

/**
 * Built-in data sources for HUD widgets. A widget's `source` field is either
 * one of these keys, or the name of a probe the sketch pushed via hud.push().
 *
 * Recording determinism: every built-in below reads only deterministic state
 * (options, frameCount, animation.progression, frame-based time). The "fps"
 * source falls back to the *target* framerate during recording so captures are
 * reproducible — the measured frameRate() (wall-clock) is used only for live
 * preview.
 *
 * Future (kept out of v1): live inputs such as audio bands or pointers from
 * interaction/index.js could be exposed here behind an "audio:N" / "pointer:N"
 * prefix. They are non-deterministic (live mic/camera) and must be skipped
 * while time.isRecording, so they are intentionally not wired yet.
 */

const BUILTINS = {
  fps: () => {
    if ( time.isRecording ) {
      return options.animation?.framerate ?? 60;
    }

    // Live preview: measured rate, falling back to the target until p5's
    // frameRate() has settled (it reads 0 on the very first frames).
    const measured = Math.round( getP5()?.frameRate?.() ?? 0 );

    return measured > 0 ? measured : ( options.animation?.framerate ?? 60 );
  },
  framerate: () => options.animation?.framerate ?? 60,
  resolution: () => `${ options.size?.width ?? 0 }x${ options.size?.height ?? 0 }`,
  width: () => options.size?.width ?? 0,
  height: () => options.size?.height ?? 0,
  frame: () => getP5()?.frameCount ?? 0,
  frames: () =>
    Math.round( ( options.animation?.duration ?? 0 ) * ( options.animation?.framerate ?? 0 ) ),
  progression: () => animation.progression,
  "progress%": () => animation.progression * 100,
  seconds: () => time.seconds(),
  duration: () => options.animation?.duration ?? 0,
  center: () => {
    const p = getP5();

    return p
      ? {
        x: p.width / 2,
        y: p.height / 2
      }
      : {
        x: 0,
        y: 0
      };
  },
  mouse: () => {
    const p = getP5();

    return p
      ? {
        x: p.mouseX,
        y: p.mouseY
      }
      : {
        x: 0,
        y: 0
      };
  }
};

const BUILTIN_META = {
  fps: {
    label: "FPS"
  },
  framerate: {
    label: "FPS"
  },
  resolution: {
    label: "RES"
  },
  width: {
    label: "W"
  },
  height: {
    label: "H"
  },
  frame: {
    label: "FRAME"
  },
  frames: {
    label: "FRAMES"
  },
  progression: {
    label: "PROG"
  },
  "progress%": {
    label: "PROGRESS",
    unit: "%"
  },
  seconds: {
    label: "TIME",
    unit: "s"
  },
  duration: {
    label: "DURATION",
    unit: "s"
  }
};

export const BUILTIN_KEYS = Object.keys( BUILTINS );

export function isBuiltin( source ) {
  return Object.prototype.hasOwnProperty.call(
    BUILTINS,
    source
  );
}

/**
 * Resolve a binding to its current value. May be a number, string, a point
 * ({ x, y }), or a color (rgb/rgba array), depending on the source.
 */
export function resolveValue( source ) {
  if ( isBuiltin( source ) ) {
    return BUILTINS[ source ]();
  }

  return probes.get( source );
}

/**
 * Resolve display metadata ({ label, unit, color }) for a binding, merging
 * built-in defaults or probe meta.
 */
export function resolveMeta( source ) {
  if ( isBuiltin( source ) ) {
    return BUILTIN_META[ source ] ?? {};
  }

  return probes.getMeta( source ) ?? {};
}
