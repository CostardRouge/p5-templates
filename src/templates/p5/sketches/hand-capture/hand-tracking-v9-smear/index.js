import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import * as common from "@/p5/utils/common.js";
import videos from "@/p5/utils/videos.js";
import mediapipe from "@/p5/utils/mediapipe/mediapipe.js";

import {
  HandCaptureScene
} from "../_shared.js";

const scene = new HandCaptureScene( {
  layers: {
    hands: {}
  }
} );

// Off-screen buffers + paint state. Created in setup, persist across frames.
let source = null;
let paint = null;
let pool = null;

// The painted path: an ordered list of colour stamps sampled from the asset.
const stamps = [];
let paintPrevious = new Map();
let idleFrames = 0;
let lastAdded = 0;

sketch.setup( async() => {
  await scene.init( options.sketch?.interaction ?? {} );

  const p = getP5();

  source = p.createGraphics(
    p.width,
    p.height
  );
  paint = p.createGraphics(
    p.width,
    p.height
  );
  pool = videos.attach( () => options.sketch?.videos );
} );

sketch.draw( () => {
  const p = getP5();

  if ( !source || !paint ) {
    return;
  }

  const interaction = options.sketch?.interaction ?? {};
  const sourceOptions = options.sketch?.source ?? {};
  const brush = options.sketch?.brush ?? {};
  const trail = options.sketch?.trail ?? {};
  const handDrawing = options.sketch?.hands ?? {};
  const text = options.sketch?.text ?? {};
  const background = options.sketch?.backgroundColor ?? options.colors?.background ?? [
    0
  ];

  scene.beginFrame( background );
  scene.readInteraction( interaction );

  const ready = updateSource( sourceOptions );

  if ( ready ) {
    paintStrokes( brush );
  } else {
    lastAdded = 0;
  }

  applyRewind( trail );
  renderPaint( brush );

  const assetOpacity = sourceOptions.assetOpacity ?? 0;

  if ( ready && assetOpacity > 0 ) {
    p.push();
    p.tint(
      255,
      assetOpacity * 255
    );
    p.image(
      source,
      0,
      0,
      p.width,
      p.height
    );
    p.pop();
  }

  p.image(
    paint,
    0,
    0,
    p.width,
    p.height
  );

  if ( handDrawing.show ?? true ) {
    scene.drawInteraction( {
      innerCircleSize: handDrawing.size ?? 24,
      shadowsCount: handDrawing.glow ?? 2,
      vectorsStep: handDrawing.resolution ?? 0.1
    } );
  }

  scene.compose();

  scene.drawTitle( {
    subtitle: text.subtitle ?? "smear · hand tracking v8",
    show: text.show ?? true,
    color: background
  } );
} );

// Draw the selected asset (image / video / webcam) cover-fit into `source`.
// Returns false until the chosen source has a usable frame.
function updateSource( sourceOptions ) {
  const frame = currentFrame( sourceOptions );

  if ( !frame ) {
    return false;
  }

  const mirror = sourceOptions.mirror ?? true;
  const scale = Math.max(
    source.width / frame.width,
    source.height / frame.height
  );
  const drawWidth = frame.width * scale;
  const drawHeight = frame.height * scale;
  const offsetX = ( source.width - drawWidth ) / 2;
  const offsetY = ( source.height - drawHeight ) / 2;

  source.push();
  source.clear();

  if ( mirror ) {
    source.translate(
      source.width,
      0
    );
    source.scale(
      -1,
      1
    );
  }

  source.image(
    frame.drawable,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );
  source.pop();

  return true;
}

function currentFrame( sourceOptions ) {
  const mode = sourceOptions.mode ?? "webcam";

  if ( mode === "image" ) {
    const asset = common.getAsset( sourceOptions.image );

    if ( asset?.img?.width ) {
      return {
        drawable: asset.img,
        width: asset.img.width,
        height: asset.img.height
      };
    }

    return null;
  }

  if ( mode === "video" ) {
    const item = pool?.first();
    const element = item?.source?.element;

    if ( item?.ready && element?.videoWidth ) {
      return {
        drawable: item.graphics,
        width: element.videoWidth,
        height: element.videoHeight
      };
    }

    return null;
  }

  const capture = mediapipe.capture?.element;

  if ( capture && mediapipe.videoReady ) {
    const width = mediapipe.capture?.size?.width || capture.elt?.videoWidth;
    const height = mediapipe.capture?.size?.height || capture.elt?.videoHeight;

    if ( width && height ) {
      return {
        drawable: capture,
        width,
        height
      };
    }
  }

  return null;
}

// Sample the asset's colours under every tracked point and append stamps along
// each point's movement since last frame, so fast swipes stay continuous.
function paintStrokes( brush ) {
  const size = brush.size ?? 36;
  const spacing = Math.max(
    1,
    size * ( brush.spacing ?? 0.35 )
  );
  const maxStamps = brush.maxStamps ?? 2000;
  const current = new Map();
  let added = 0;

  for ( const group of scene.groups ) {
    group.points.forEach( (
      point, index
    ) => {
      const key = `${ group.id }:${ index }`;

      current.set(
        key,
        {
          x: point.x,
          y: point.y
        }
      );

      const previous = paintPrevious.get( key );

      if ( previous ) {
        added += stampSegment(
          previous,
          point,
          spacing,
          size,
          maxStamps
        );
      } else {
        added += stampAt(
          point.x,
          point.y,
          size,
          maxStamps
        );
      }
    } );
  }

  paintPrevious = current;
  lastAdded = added;
}

function stampSegment(
  from, to, spacing, size, maxStamps
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(
    dx,
    dy
  );
  const steps = Math.min(
    40,
    Math.max(
      1,
      Math.round( distance / spacing )
    )
  );

  let added = 0;

  for ( let step = 1; step <= steps; step++ ) {
    const t = step / steps;

    added += stampAt(
      from.x + dx * t,
      from.y + dy * t,
      size,
      maxStamps
    );
  }

  return added;
}

function stampAt(
  x, y, size, maxStamps
) {
  const color = sampleColor(
    x,
    y
  );

  if ( !color ) {
    return 0;
  }

  stamps.push( {
    x,
    y,
    d: size,
    color
  } );

  if ( stamps.length > maxStamps ) {
    stamps.shift();
  }

  return 1;
}

function sampleColor(
  x, y
) {
  if ( x < 0 || y < 0 || x >= source.width || y >= source.height ) {
    return null;
  }

  const c = source.get(
    Math.floor( x ),
    Math.floor( y )
  );

  if ( !c || c[ 3 ] === 0 ) {
    return null;
  }

  return [
    c[ 0 ],
    c[ 1 ],
    c[ 2 ]
  ];
}

// In rewind mode the path retraces itself: once the hand pauses past `hold`
// frames, stamps are removed from the newest end at `rewindSpeed` per frame.
function applyRewind( trail ) {
  const mode = trail.mode ?? "permanent";

  if ( mode !== "rewind" || lastAdded > 0 ) {
    idleFrames = 0;
    return;
  }

  idleFrames += 1;

  if ( idleFrames <= ( trail.hold ?? 20 ) ) {
    return;
  }

  const speed = Math.max(
    1,
    Math.round( trail.rewindSpeed ?? 8 )
  );

  stamps.length = Math.max(
    0,
    stamps.length - speed
  );
}

function renderPaint( brush ) {
  const opacity = brush.opacity ?? 200;

  paint.clear();
  paint.noStroke();

  for ( const stamp of stamps ) {
    paint.fill(
      stamp.color[ 0 ],
      stamp.color[ 1 ],
      stamp.color[ 2 ],
      opacity
    );
    paint.circle(
      stamp.x,
      stamp.y,
      stamp.d
    );
  }
}
