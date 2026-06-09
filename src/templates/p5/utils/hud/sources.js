import options from "../options.js";
import animation from "../animation.js";
import time from "../time.js";
import {
  getP5
} from "../sketch.js";
import {
  getByPath
} from "./keyPaths.js";

/**
 * Resolve a HUD widget's data source. A `source` is either a built-in live key
 * (fps / frame / progression / resolution …) or a dotted key-path into the live
 * sketch settings ("magnitude.start"), read exactly like the specs overlay
 * enumerates them — no probe registry required.
 *
 * Recording determinism: built-ins read only deterministic state (frameCount,
 * animation.progression, target framerate during capture). Key-path values come
 * straight from the (deterministic) sketch settings.
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

export function isBuiltin( source ) {
  return Object.prototype.hasOwnProperty.call(
    BUILTINS,
    source
  );
}

/**
 * Resolve a binding to its current value. May be a number, string, a point
 * ({ x, y }) or a colour array, depending on the source.
 */
export function resolveValue( source ) {
  if ( !source ) {
    return undefined;
  }

  if ( isBuiltin( source ) ) {
    return BUILTINS[ source ]();
  }

  return getByPath(
    options.sketch,
    source
  );
}

/**
 * Resolve display metadata ({ label, unit }) for a binding: built-in defaults,
 * else the last key-path segment as a label.
 */
export function resolveMeta( source ) {
  if ( isBuiltin( source ) ) {
    return BUILTIN_META[ source ] ?? {};
  }

  return {
    label: String( source ?? "" ).split( "." )
      .pop()
  };
}
