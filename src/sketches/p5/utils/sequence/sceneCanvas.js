// ── Buffers for the generated scenes (splash, loader, plate) ────────────────
//
// A sketch scene draws into the buffer nestedSketch.js keeps for it; the
// generated scenes need a P2D buffer of their own, kept here under the same
// "<layer key>:scene:<n>" key and swept the same way when the scene stops
// being drawn.

import {
  getHostP5
} from "../sketch.js";

const IDLE_FRAMES_BEFORE_DISPOSE = 180;

const buffers = new Map();

let lastSweepFrame = -1;

function dispose( record ) {
  try {
    record.graphics?.remove?.();
  } catch {
    // Already gone.
  }

  record.graphics = null;
}

/**
 * The P2D graphics for one generated scene, `pixelWidth` × `pixelHeight`,
 * created or resized as needed. Null without a host.
 */
export function sceneGraphics(
  key, pixelWidth, pixelHeight
) {
  const host = getHostP5();

  if ( !host || !( pixelWidth > 0 ) || !( pixelHeight > 0 ) ) {
    return null;
  }

  const frame = host.frameCount ?? 0;

  if ( frame !== lastSweepFrame ) {
    lastSweepFrame = frame;
    sweepSceneGraphics( frame );
  }

  let record = buffers.get( key );

  if ( !record ) {
    record = {
      graphics: null,
      width: 0,
      height: 0,
      lastSeenFrame: frame
    };
    buffers.set(
      key,
      record
    );
  }

  record.lastSeenFrame = frame;

  if ( !record.graphics ) {
    record.graphics = host.createGraphics(
      pixelWidth,
      pixelHeight
    );
    record.graphics.canvas?.remove?.();
    record.width = pixelWidth;
    record.height = pixelHeight;
  } else if ( record.width !== pixelWidth || record.height !== pixelHeight ) {
    record.graphics.resizeCanvas(
      pixelWidth,
      pixelHeight
    );
    record.graphics.width = pixelWidth;
    record.graphics.height = pixelHeight;
    record.width = pixelWidth;
    record.height = pixelHeight;
  }

  return record.graphics;
}

export function sweepSceneGraphics( frame = getHostP5()?.frameCount ?? 0 ) {
  buffers.forEach( (
    record, key
  ) => {
    if ( frame - ( record.lastSeenFrame ?? 0 ) > IDLE_FRAMES_BEFORE_DISPOSE ) {
      dispose( record );
      buffers.delete( key );
    }
  } );
}

export function disposeSceneGraphics() {
  buffers.forEach( dispose );
  buffers.clear();
  lastSweepFrame = -1;
}
