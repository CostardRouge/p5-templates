import clamp from "@/utils/clamp";
import {
  snapToAxis,
  type Axes3D,
  type Vector3DKind,
  type Vector3DValue
} from "../utils/vector3dMath";

/** What every view receives: the same value, the same way to write it back. */
export interface ViewProps {
  /** Complete, snapped value — what the form holds. */
  current: Vector3DValue;
  axes: Axes3D;
  yDown: boolean;
  kind: Vector3DKind;
  /** Writes a whole vector; the pad snaps and clamps it per axis. */
  commit: ( next: Vector3DValue ) => void;
  ariaLabel: string;
}

/** The 2D pad's frame, so the four views and the pad read as one family. */
export const VIEW_FRAME_CLASS =
  "relative touch-none select-none overflow-hidden rounded-lg border border-theme bg-background/50 focus:outline-none focus:ring-1 focus:ring-theme";

/** Tiny corner caption naming an axis or a view, as on the 2D pad. */
export const AXIS_LABEL_CLASS =
  "pointer-events-none absolute bg-background/70 px-px font-mono text-[7px] leading-none text-gray-400";

/**
 * Pointer position as a fraction of the element's box, top-left origin, not
 * clamped — a drag may leave the box and the caller decides what that means
 * (the trackball keeps rotating, a pad clamps).
 */
export function pointerFraction(
  event: {
    clientX: number;
    clientY: number;
  },
  element: Element
): {
  fx: number;
  fy: number;
} {
  const rect = element.getBoundingClientRect();

  return {
    fx: rect.width > 0 ? ( event.clientX - rect.left ) / rect.width : 0,
    fy: rect.height > 0 ? ( event.clientY - rect.top ) / rect.height : 0
  };
}

/**
 * Keyboard nudge shared by every view: arrows move x / y (Up is "up on the
 * canvas", which `yDown` decides), PageUp / PageDown move z, Shift multiplies
 * the step by ten. Returns null for any other key so the caller can let it
 * through.
 */
export function nudgeFromKey(
  event: {
    key: string;
    shiftKey: boolean;
  },
  current: Vector3DValue,
  axes: Axes3D,
  yDown: boolean
): Vector3DValue | null {
  const moves: Record<string, Vector3DValue> = {
    ArrowLeft: {
      x: -1,
      y: 0,
      z: 0
    },
    ArrowRight: {
      x: 1,
      y: 0,
      z: 0
    },
    ArrowUp: {
      x: 0,
      y: yDown ? -1 : 1,
      z: 0
    },
    ArrowDown: {
      x: 0,
      y: yDown ? 1 : -1,
      z: 0
    },
    PageUp: {
      x: 0,
      y: 0,
      z: 1
    },
    PageDown: {
      x: 0,
      y: 0,
      z: -1
    }
  };

  const move = moves[ event.key ];

  if ( !move ) {
    return null;
  }

  const factor = event.shiftKey ? 10 : 1;

  return {
    x: snapToAxis(
      current.x + move.x * factor * ( axes.xAxis.step ?? 0.01 ),
      axes.xAxis
    ),
    y: snapToAxis(
      current.y + move.y * factor * ( axes.yAxis.step ?? 0.01 ),
      axes.yAxis
    ),
    z: snapToAxis(
      current.z + move.z * factor * ( axes.zAxis.step ?? 0.01 ),
      axes.zAxis
    )
  };
}

/** Clamps a cube-space coordinate into the box. */
export function clampCube( c: Vector3DValue ): Vector3DValue {
  return {
    x: clamp(
      c.x,
      -1,
      1
    ),
    y: clamp(
      c.y,
      -1,
      1
    ),
    z: clamp(
      c.z,
      -1,
      1
    )
  };
}
