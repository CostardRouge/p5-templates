import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import events from "@/p5/utils/events.js";
import mediapipe from "@/p5/utils/mediapipe/mediapipe.js";
import {
  initInteraction,
  getPointerGroups,
  HAND_FINGER_JOINT_INDICES
} from "@/p5/utils/interaction/index.js";
import {
  createDraggable
} from "@/p5/utils/interaction/draggable.js";
import {
  createClipRecorder
} from "@/p5/utils/interaction/handClips/recorder.js";
import {
  bakeHandClip,
  deriveAnchors,
  gapSeries
} from "@/p5/utils/interaction/handClips/process.js";
import {
  downloadHandClip,
  handClipLayout,
  serializeHandClip
} from "@/p5/shared/handClip.js";

// ─────────────────────────────────────────────────────────────────────────────
// hand-clip studio v1 — record your own hand into portable `p5t-handclip`
// takes, the raw material of the "virtual hands" that replay through the
// pinch/drag layer like live camera hands (see shared/handClips/README.md).
//
// A session is a loop of takes:
//
//   IDLE       the camera + your live hand skeleton, the prompter's
//              instruction and two draggable targets A (grab here) and
//              B (release here). R arms a take.
//   COUNTDOWN  big digits; the recorder starts on zero.
//   RECORDING  samples are pushed on every INFERENCE (not every draw frame —
//              see handClips/recorder.js); live fps / sample / dropout
//              readout. R or the max length ends it.
//   REVIEW     the take is baked (process.js) and replayed as a ghost hand
//              over a scrubbable timeline showing the thumb/index gap, the
//              detected pinch interval and its close/open markers, which can
//              be nudged when the auto-detection lands off. The raw and the
//              baked pinch paths are overlaid so the smoothing is visible,
//              and a calibration readout says which playback hand scale keeps
//              the recorded pinch on the right side of a target sketch's
//              pinch threshold. E downloads the clip; S (dev only) writes it
//              straight into shared/handClips/; K keeps it in the session
//              list; R records again.
//
// This is a tool, not a piece: it runs on real time (deltaTime), reads the
// camera, and is not meant for deterministic capture.
// ─────────────────────────────────────────────────────────────────────────────

const draggable = createDraggable();
const recorder = createClipRecorder();

const TARGET_RADIUS = 34;
const TIMELINE_HEIGHT = 96;
const TIMELINE_MARGIN = 28;
const HUD_MARGIN = 24;

const state = {
  mode: "idle",
  countdownLeft: 0,
  scenario: 0,
  // Canvas-space targets [A, B], re-derived from the options when those
  // change (signature) and mutated in place by the drag layer.
  targets: [],
  targetsKey: "",
  // Current review subject.
  take: null,
  clip: null,
  gaps: null,
  playhead: 0,
  playing: false,
  // Takes kept this session (K), cycled with N.
  kept: [],
  keptIndex: -1,
  takeCounter: 0,
  // Transient status line.
  message: "",
  messageAt: 0,
  showHelp: true,
  unregisterKey: null
};

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function flash( message ) {
  state.message = message;
  state.messageAt = performance.now();
}

function tagsOf( text ) {
  return String( text ?? "" )
    .split( "," )
    .map( ( tag ) => tag.trim() )
    .filter( Boolean );
}

function visionFlip( interaction ) {
  const vision = interaction?.vision;
  const mode = vision?.source?.mode ?? "webcam";

  if ( mode === "video" || mode === "image" ) {
    return vision?.source?.flip ?? false;
  }

  return vision?.source?.flip ?? true;
}

// ── Targets ─────────────────────────────────────────────────────────────────

function syncTargets(
  p, prompter
) {
  const a = prompter.a ?? {
    x: 0.3,
    y: 0.5
  };
  const b = prompter.b ?? {
    x: 0.7,
    y: 0.5
  };
  const key = [
    a.x,
    a.y,
    b.x,
    b.y,
    p.width,
    p.height
  ].join( "|" );

  if ( state.targetsKey === key ) {
    return;
  }

  state.targetsKey = key;
  state.targets = [
    {
      x: a.x * p.width,
      y: a.y * p.height
    },
    {
      x: b.x * p.width,
      y: b.y * p.height
    }
  ];
}

// ── Take lifecycle ──────────────────────────────────────────────────────────

function armTake( record ) {
  state.mode = "countdown";
  state.countdownLeft = Math.max(
    0,
    record.countdown ?? 3
  );
  state.playing = false;
}

function beginTake( o ) {
  recorder.start( {
    layout: o.clip?.layout ?? "landmarks-21",
    hand: o.clip?.hand ?? "any",
    flip: visionFlip( o.interaction )
  } );
  state.mode = "recording";
}

function loadReview(
  clip, take
) {
  state.take = take ?? null;
  state.clip = clip;
  state.gaps = gapSeries( clip );
  state.playhead = 0;
  state.playing = true;
  state.mode = "review";
}

function endTake( o ) {
  const take = recorder.stop();

  if ( take.samples.length < 2 ) {
    state.mode = "idle";
    flash( "No hand tracked during the take — nothing to bake." );

    return;
  }

  const bake = o.bake ?? {};

  state.takeCounter++;

  try {
    const clip = bakeHandClip(
      take.samples,
      {
        name: `${ o.clip?.name || "hand-clip" }-${ state.takeCounter }`,
        tags: tagsOf( o.clip?.tags ),
        handedness: take.handedness,
        layout: take.layout,
        aspect: take.aspect,
        fps: bake.fps ?? 60,
        filter: {
          minCutoff: bake.minCutoff ?? 1.2,
          beta: bake.beta ?? 0.02,
          zeroPhase: bake.zeroPhase !== false
        },
        recordedAt: take.recordedAt
      }
    );

    loadReview(
      clip,
      take
    );
    flash( clip.phases
      ? `Baked ${ clip.frameCount } frames — pinch detected.`
      : `Baked ${ clip.frameCount } frames — no pinch found, set the markers with [ ] { }.` );
  } catch( error ) {
    state.mode = "idle";
    flash( `Bake failed: ${ error?.message ?? error }` );
  }
}

// Rewrite the clip's phases from a close/open pair and re-derive the anchors
// — the studio's manual override of the auto-detection.
function setPhases(
  clip, close, open
) {
  const last = clip.frameCount - 1;
  const c = clamp(
    Math.round( close ),
    0,
    last
  );
  const oFrame = clamp(
    Math.round( open ),
    c + 1,
    clip.frameCount
  );

  clip.phases = {
    enter: [
      0,
      c
    ],
    close: c,
    drag: [
      c,
      oFrame
    ],
    open: oFrame,
    exit: [
      oFrame,
      clip.frameCount
    ]
  };
  clip.anchors = deriveAnchors(
    clip,
    clip.phases
  );
}

function nudgeMarker(
  which, delta
) {
  const clip = state.clip;

  if ( !clip ) {
    return;
  }

  const phases = clip.phases ?? {
    close: Math.round( state.playhead ),
    open: Math.min(
      Math.round( state.playhead ) + 1,
      clip.frameCount
    )
  };

  setPhases(
    clip,
    which === "close" ? phases.close + delta : phases.close,
    which === "open" ? phases.open + delta : phases.open
  );
  state.playing = false;
  state.playhead = which === "close" ? clip.phases.close : Math.min(
    clip.phases.open,
    clip.frameCount - 1
  );
}

async function saveToLibrary( clip ) {
  if ( process.env.NODE_ENV !== "development" ) {
    flash( "Saving into the library is dev-only — press E to download instead." );

    return;
  }

  try {
    const response = await fetch(
      "/api/dev/save-hand-clip",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify( {
          clip: JSON.parse( serializeHandClip( clip ) )
        } )
      }
    );

    if ( !response.ok ) {
      throw new Error( await response.text() || `HTTP ${ response.status }` );
    }

    const data = await response.json();

    flash( `Saved → ${ data.file }` );
  } catch( error ) {
    flash( `Save failed: ${ error?.message ?? error }` );
  }
}

// ── Keys ────────────────────────────────────────────────────────────────────

function onKeyTyped() {
  const p = getP5();
  const o = options.sketch ?? {};
  const key = p?.key ?? "";
  const lower = key.toLowerCase();

  if ( lower === "h" ) {
    state.showHelp = !state.showHelp;

    return;
  }

  if ( /^[1-9]$/.test( key ) ) {
    const count = ( o.prompter?.scenarios ?? [] ).length;

    if ( count > 0 ) {
      state.scenario = Math.min(
        Number( key ) - 1,
        count - 1
      );
    }

    return;
  }

  if ( lower === "r" ) {
    if ( state.mode === "recording" ) {
      endTake( o );
    } else if ( state.mode !== "countdown" ) {
      armTake( o.record ?? {} );
    }

    return;
  }

  if ( state.mode !== "review" || !state.clip ) {
    return;
  }

  const clip = state.clip;

  switch ( key ) {
    case "p":
    case "P":
      state.playing = !state.playing;
      break;
    case ",":
      state.playing = false;
      state.playhead = clamp(
        Math.round( state.playhead ) - 1,
        0,
        clip.frameCount - 1
      );
      break;
    case ".":
      state.playing = false;
      state.playhead = clamp(
        Math.round( state.playhead ) + 1,
        0,
        clip.frameCount - 1
      );
      break;
    case "[":
      nudgeMarker(
        "close",
        -1
      );
      break;
    case "]":
      nudgeMarker(
        "close",
        1
      );
      break;
    case "{":
      nudgeMarker(
        "open",
        -1
      );
      break;
    case "}":
      nudgeMarker(
        "open",
        1
      );
      break;
    case "e":
    case "E":
      downloadHandClip( clip );
      flash( `Downloaded ${ clip.name }.handclip.json` );
      break;
    case "s":
    case "S":
      saveToLibrary( clip );
      break;
    case "k":
    case "K":
      state.kept.push( {
        clip,
        take: state.take
      } );
      state.keptIndex = state.kept.length - 1;
      flash( `Kept ${ clip.name } (${ state.kept.length } in session).` );
      break;
    case "n":
    case "N":
      if ( state.kept.length > 0 ) {
        state.keptIndex = ( state.keptIndex + 1 ) % state.kept.length;

        const entry = state.kept[ state.keptIndex ];

        loadReview(
          entry.clip,
          entry.take
        );
        flash( `Reviewing ${ entry.clip.name } (${ state.keptIndex + 1 }/${ state.kept.length }).` );
      }
      break;
    case "x":
    case "X":
      state.mode = "idle";
      state.playing = false;
      break;
    default:
      break;
  }
}

// ── Drawing ─────────────────────────────────────────────────────────────────

function drawCamera(
  p, opacity
) {
  const element = mediapipe.capture?.element;

  if ( !element || !mediapipe.capture.owned || !mediapipe.videoReady || opacity <= 0 ) {
    return;
  }

  p.push();
  p.tint(
    255,
    255 * clamp(
      opacity,
      0,
      1
    )
  );
  p.image(
    element,
    0,
    0,
    p.width,
    p.height
  );
  p.pop();
}

function drawTargets(
  p, accent, hovers, grabbed
) {
  const [
    a,
    b
  ] = state.targets;

  if ( !a || !b ) {
    return;
  }

  p.push();
  p.drawingContext.setLineDash( [
    10,
    12
  ] );
  p.stroke(
    255,
    255,
    255,
    110
  );
  p.strokeWeight( 2 );
  p.line(
    a.x,
    a.y,
    b.x,
    b.y
  );
  p.drawingContext.setLineDash( [] );

  [
    a,
    b
  ].forEach( (
    target, index
  ) => {
    const active = grabbed.has( index );
    const hover = hovers.has( index );

    p.noStroke();
    p.fill(
      ...accent,
      active ? 90 : hover ? 60 : 36
    );
    p.circle(
      target.x,
      target.y,
      TARGET_RADIUS * 2
    );
    p.stroke( ...accent );
    p.strokeWeight( active ? 4 : 2 );
    p.noFill();
    p.circle(
      target.x,
      target.y,
      TARGET_RADIUS * 2
    );
    p.noStroke();
    p.fill( 255 );
    p.textAlign(
      p.CENTER,
      p.CENTER
    );
    p.textSize( 22 );
    p.text(
      index === 0 ? "A" : "B",
      target.x,
      target.y + 1
    );
  } );

  p.pop();
}

// A hand skeleton from normalized points of either layout: finger chains for
// the full hand, wrist→tip spokes for the compact one.
function drawSkeleton(
  p, points, layout, color, alpha, weight
) {
  if ( !points ) {
    return;
  }

  const desc = handClipLayout( layout );
  const px = ( i ) => ( {
    x: points[ i ].x * p.width,
    y: points[ i ].y * p.height
  } );

  p.push();
  p.stroke(
    ...color,
    alpha
  );
  p.strokeWeight( weight );
  p.noFill();

  if ( desc.pointCount === 21 ) {
    Object.values( HAND_FINGER_JOINT_INDICES ).forEach( ( chain ) => {
      p.beginShape();
      chain.forEach( ( i ) => {
        const pt = px( i );

        p.vertex(
          pt.x,
          pt.y
        );
      } );
      p.endShape();
    } );

    // Palm outline: wrist → finger bases → wrist.
    p.beginShape();
    [
      0,
      5,
      9,
      13,
      17,
      0
    ].forEach( ( i ) => {
      const pt = px( i );

      p.vertex(
        pt.x,
        pt.y
      );
    } );
    p.endShape();
  } else {
    const wrist = px( desc.palm );

    desc.fingertips.forEach( ( i ) => {
      const pt = px( i );

      p.line(
        wrist.x,
        wrist.y,
        pt.x,
        pt.y
      );
    } );
  }

  p.noStroke();
  p.fill(
    ...color,
    alpha
  );
  points.forEach( (
    _, i
  ) => {
    const pt = px( i );

    p.circle(
      pt.x,
      pt.y,
      i === desc.thumbTip || i === desc.indexTip ? 12 : 6
    );
  } );

  // Pinch midpoint.
  const thumb = px( desc.thumbTip );
  const index = px( desc.indexTip );

  p.stroke(
    ...color,
    alpha
  );
  p.strokeWeight( 2 );
  p.line(
    thumb.x,
    thumb.y,
    index.x,
    index.y
  );
  p.noStroke();
  p.fill(
    255,
    alpha
  );
  p.circle(
    ( thumb.x + index.x ) / 2,
    ( thumb.y + index.y ) / 2,
    8
  );
  p.pop();
}

function clipFramePoints(
  clip, frame
) {
  const desc = handClipLayout( clip );
  const base = Math.round( frame ) * desc.pointCount * 2;
  const points = [];

  for ( let i = 0; i < desc.pointCount; i++ ) {
    points.push( {
      x: clip.frames[ base + i * 2 ],
      y: clip.frames[ base + i * 2 + 1 ]
    } );
  }

  return points;
}

function pinchMidOf(
  points, desc
) {
  return {
    x: ( points[ desc.thumbTip ].x + points[ desc.indexTip ].x ) / 2,
    y: ( points[ desc.thumbTip ].y + points[ desc.indexTip ].y ) / 2
  };
}

// Raw (thin, grey) vs baked (accent) pinch-midpoint paths, so the smoothing
// and resampling are visible rather than trusted.
function drawPinchPaths(
  p, clip, take, accent
) {
  const desc = handClipLayout( clip );

  p.push();
  p.noFill();

  if ( take?.samples?.length > 1 ) {
    p.stroke(
      255,
      255,
      255,
      70
    );
    p.strokeWeight( 1.5 );
    p.beginShape();
    take.samples.forEach( ( sample ) => {
      const mid = pinchMidOf(
        sample.points,
        desc
      );

      p.vertex(
        mid.x * p.width,
        mid.y * p.height
      );
    } );
    p.endShape();
  }

  p.stroke(
    ...accent,
    170
  );
  p.strokeWeight( 3 );
  p.beginShape();

  for ( let frame = 0; frame < clip.frameCount; frame++ ) {
    const base = frame * desc.pointCount * 2;
    const tx = clip.frames[ base + desc.thumbTip * 2 ];
    const ty = clip.frames[ base + desc.thumbTip * 2 + 1 ];
    const ix = clip.frames[ base + desc.indexTip * 2 ];
    const iy = clip.frames[ base + desc.indexTip * 2 + 1 ];

    p.vertex(
      ( tx + ix ) / 2 * p.width,
      ( ty + iy ) / 2 * p.height
    );
  }

  p.endShape();

  // Anchors.
  if ( clip.anchors ) {
    p.noStroke();
    [
      [
        clip.anchors.grab,
        "grab"
      ],
      [
        clip.anchors.release,
        "release"
      ]
    ].forEach( ( [
      anchor,
      label
    ] ) => {
      p.fill( ...accent );
      p.circle(
        anchor.x * p.width,
        anchor.y * p.height,
        14
      );
      p.fill( 255 );
      p.textSize( 13 );
      p.textAlign(
        p.LEFT,
        p.CENTER
      );
      p.text(
        label,
        anchor.x * p.width + 12,
        anchor.y * p.height
      );
    } );
  }

  p.pop();
}

function timelineRect( p ) {
  return {
    x: TIMELINE_MARGIN,
    y: p.height - TIMELINE_MARGIN - TIMELINE_HEIGHT,
    w: p.width - TIMELINE_MARGIN * 2,
    h: TIMELINE_HEIGHT
  };
}

function drawTimeline(
  p, clip, gaps, accent
) {
  const rect = timelineRect( p );
  const last = Math.max(
    1,
    clip.frameCount - 1
  );
  const xOf = ( frame ) => rect.x + rect.w * frame / last;
  const [
    gapMin,
    gapMax
  ] = clip.gapRange ?? [
    0,
    1
  ];
  const range = Math.max(
    gapMax - gapMin,
    1e-6
  );
  const yOf = ( gap ) => rect.y + rect.h - 8 - ( rect.h - 16 ) * ( gap - gapMin ) / range;

  p.push();
  p.noStroke();
  p.fill(
    0,
    0,
    0,
    170
  );
  p.rect(
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    6
  );

  // Pinch interval.
  if ( clip.phases ) {
    p.fill(
      ...accent,
      45
    );
    p.rect(
      xOf( clip.phases.close ),
      rect.y,
      xOf( clip.phases.open ) - xOf( clip.phases.close ),
      rect.h
    );
  }

  // Gap curve.
  p.noFill();
  p.stroke(
    255,
    255,
    255,
    200
  );
  p.strokeWeight( 1.5 );
  p.beginShape();

  for ( let frame = 0; frame < clip.frameCount; frame++ ) {
    p.vertex(
      xOf( frame ),
      yOf( gaps[ frame ] )
    );
  }

  p.endShape();

  // Markers.
  if ( clip.phases ) {
    p.stroke( ...accent );
    p.strokeWeight( 2 );
    p.line(
      xOf( clip.phases.close ),
      rect.y,
      xOf( clip.phases.close ),
      rect.y + rect.h
    );
    p.line(
      xOf( clip.phases.open ),
      rect.y,
      xOf( clip.phases.open ),
      rect.y + rect.h
    );
    p.noStroke();
    p.fill( ...accent );
    p.textSize( 11 );
    p.textAlign(
      p.LEFT,
      p.TOP
    );
    p.text(
      `close ${ clip.phases.close }`,
      xOf( clip.phases.close ) + 4,
      rect.y + 4
    );
    p.textAlign(
      p.RIGHT,
      p.TOP
    );
    p.text(
      `open ${ clip.phases.open }`,
      xOf( clip.phases.open ) - 4,
      rect.y + 4
    );
  }

  // Playhead.
  p.stroke( 255 );
  p.strokeWeight( 2 );
  p.line(
    xOf( state.playhead ),
    rect.y,
    xOf( state.playhead ),
    rect.y + rect.h
  );
  p.pop();
}

function scrubTimeline(
  p, groups, clip
) {
  const mouse = groups.find( ( group ) => group.source === "mouse" );

  if ( !mouse || !p.mouseIsPressed ) {
    return;
  }

  const rect = timelineRect( p );
  const {
    x,
    y
  } = mouse.points[ 0 ];

  if ( x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h ) {
    return;
  }

  state.playing = false;
  state.playhead = clamp(
    ( x - rect.x ) / rect.w * ( clip.frameCount - 1 ),
    0,
    clip.frameCount - 1
  );
}

function hud(
  p, lines, x, y, {
    size = 15,
    align = p.LEFT,
    color = [
      255,
      255,
      255
    ],
    alpha = 230
  } = {}
) {
  p.push();
  p.noStroke();
  p.textFont( "monospace" );
  p.textSize( size );
  p.textAlign(
    align,
    p.TOP
  );
  p.fill(
    ...color,
    alpha
  );
  lines.forEach( (
    line, i
  ) => p.text(
    line,
    x,
    y + i * ( size + 6 )
  ) );
  p.pop();
}

// Which playback hand scale (px per normalized unit) keeps the recorded pinch
// on the right side of the target sketch's threshold: the closed gap must
// read under `pinchPx`, the open gap over `pinchPx × releaseRatio`.
function calibrationLines(
  p, clip, calibration
) {
  const [
    gapMin,
    gapMax
  ] = clip.gapRange ?? [
    0,
    0
  ];
  const pinchPx = calibration.pinchPx ?? 70;
  const ratio = calibration.releaseRatio ?? 1.6;
  const scale = p.height;
  const lo = gapMax > 0 ? pinchPx * ratio / gapMax : Infinity;
  const hi = gapMin > 0 ? pinchPx / gapMin : Infinity;
  const lines = [
    `gap ${ ( gapMin * scale ).toFixed( 0 ) }–${ ( gapMax * scale ).toFixed( 0 ) } px at hand scale ${ scale } (canvas height)`
  ];

  if ( lo < hi ) {
    const ok = scale >= lo && scale <= hi;

    lines.push( `pinch ${ pinchPx } px ×${ ratio }: valid hand scale ${ lo.toFixed( 0 ) }–${ hi.toFixed( 0 ) } px ${ ok ? "✓" : "✗ (rescale on playback)" }` );
  } else {
    lines.push( `pinch ${ pinchPx } px ×${ ratio }: no hand scale separates closed from open — pinch more clearly` );
  }

  return lines;
}

// ── Sketch ──────────────────────────────────────────────────────────────────

sketch.setup( async() => {
  state.mode = "idle";
  state.targetsKey = "";
  state.take = null;
  state.clip = null;
  state.gaps = null;
  state.playing = false;
  state.kept = [];
  state.keptIndex = -1;
  state.takeCounter = 0;
  state.message = "";

  draggable.attach();
  recorder.clear();

  state.unregisterKey?.();
  state.unregisterKey = events.register(
    "engine-on-key-typed",
    onKeyTyped
  );

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const interaction = o.interaction ?? {};
  const prompter = o.prompter ?? {};
  const record = o.record ?? {};
  const review = o.review ?? {};
  const look = o.look ?? {};
  const accent = look.accent ?? [
    120,
    200,
    255
  ];
  const dt = ( p.deltaTime || 16.7 ) / 1000;

  p.background( 0 );

  // Keeps the vision pipeline configured + running, and gives us the mouse
  // in canvas space (correct under viewport zoom/pan).
  const groups = getPointerGroups( interaction );

  recorder.update( {
    layout: o.clip?.layout ?? "landmarks-21",
    hand: o.clip?.hand ?? "any",
    flip: visionFlip( interaction )
  } );
  syncTargets(
    p,
    prompter
  );

  const {
    hovers,
    grabbed
  } = draggable.update( {
    targets: state.targets,
    radius: TARGET_RADIUS + 6,
    groups,
    onMove: (
      index, pointer
    ) => {
      state.targets[ index ].x = pointer.x;
      state.targets[ index ].y = pointer.y;
    }
  } );

  // ── Mode transitions ──
  if ( state.mode === "countdown" ) {
    state.countdownLeft -= dt;

    if ( state.countdownLeft <= 0 ) {
      beginTake( o );
    }
  } else if ( state.mode === "recording" ) {
    if ( recorder.elapsed >= ( record.maxSeconds ?? 8 ) ) {
      endTake( o );
    }
  } else if ( state.mode === "review" && state.clip ) {
    scrubTimeline(
      p,
      groups,
      state.clip
    );

    if ( state.playing ) {
      state.playhead += dt * state.clip.fps * ( review.speed ?? 1 );

      if ( state.playhead > state.clip.frameCount - 1 ) {
        if ( review.loop !== false ) {
          state.playhead = 0;
        } else {
          state.playhead = state.clip.frameCount - 1;
          state.playing = false;
        }
      }
    }
  }

  // ── Scene ──
  const inReview = state.mode === "review" && state.clip;

  drawCamera(
    p,
    ( look.cameraOpacity ?? 0.55 ) * ( inReview ? 0.35 : 1 )
  );
  drawTargets(
    p,
    accent,
    hovers,
    grabbed
  );

  const layout = o.clip?.layout ?? "landmarks-21";

  if ( inReview ) {
    const clip = state.clip;
    const frame = Math.round( state.playhead );
    const phases = clip.phases;
    const pinching = phases && frame >= phases.close && frame < phases.open;

    drawPinchPaths(
      p,
      clip,
      state.take,
      accent
    );
    drawSkeleton(
      p,
      clipFramePoints(
        clip,
        frame
      ),
      clip.layout,
      pinching ? accent : [
        255,
        255,
        255
      ],
      230,
      pinching ? 4 : 2.5
    );
    // The live hand stays visible, faint, so a retake can be lined up.
    drawSkeleton(
      p,
      recorder.latest,
      layout,
      [
        255,
        255,
        255
      ],
      70,
      1.5
    );
    drawTimeline(
      p,
      clip,
      state.gaps,
      accent
    );
  } else {
    drawSkeleton(
      p,
      recorder.latest,
      layout,
      state.mode === "recording" ? accent : [
        255,
        255,
        255
      ],
      220,
      state.mode === "recording" ? 4 : 2.5
    );
  }

  // ── HUD ──
  const scenarios = Array.isArray( prompter.scenarios ) ? prompter.scenarios : [];
  const instruction = scenarios[ state.scenario ] ?? scenarios[ 0 ] ?? "";
  const stats = recorder.stats;
  const top = [];

  if ( state.mode === "idle" ) {
    top.push( `IDLE · scenario ${ state.scenario + 1 }/${ Math.max(
      scenarios.length,
      1
    ) }` );
  } else if ( state.mode === "countdown" ) {
    top.push( "GET READY" );
  } else if ( state.mode === "recording" ) {
    top.push( `● REC ${ recorder.elapsed.toFixed( 1 ) }s / ${ record.maxSeconds ?? 8 }s` );
  } else if ( inReview ) {
    const clip = state.clip;

    top.push( `REVIEW · ${ clip.name } · frame ${ Math.round( state.playhead ) }/${ clip.frameCount - 1 } ${ state.playing ? "▶" : "❚❚" }` );
  }

  top.push( instruction );

  if ( state.mode !== "review" ) {
    top.push( `tracker ${ stats.inferencesPerSecond.toFixed( 0 ) } fps · ${ stats.inferenceMilliseconds.toFixed( 0 ) } ms · hand ${ recorder.latest ? "tracked" : "—" }` );
  }

  if ( state.mode === "recording" ) {
    top.push( `samples ${ stats.samples } · dropouts ${ stats.dropouts }` );
  }

  if ( inReview ) {
    const clip = state.clip;
    const cap = clip.capture ?? {};

    top.push( `${ clip.frameCount } frames @ ${ clip.fps.toFixed( 1 ) } fps · ${ ( clip.frameCount / clip.fps ).toFixed( 2 ) }s · from ${ cap.samples ?? "?" } samples @ ${ ( cap.sourceFps ?? 0 ).toFixed( 1 ) } fps · ${ clip.layout } · ${ clip.handedness || "hand ?" }` );
    top.push( clip.phases
      ? `pinch: close ${ clip.phases.close } → open ${ clip.phases.open } (${ ( ( clip.phases.open - clip.phases.close ) / clip.fps ).toFixed( 2 ) }s drag)`
      : "pinch: none detected — set it with [ ] and { }" );
    top.push( ...calibrationLines(
      p,
      clip,
      o.calibration ?? {}
    ) );

    if ( state.kept.length > 0 ) {
      top.push( `kept this session: ${ state.kept.length } (N cycles)` );
    }
  }

  hud(
    p,
    top,
    HUD_MARGIN,
    HUD_MARGIN
  );

  if ( state.mode === "countdown" ) {
    hud(
      p,
      [
        String( Math.ceil( state.countdownLeft ) )
      ],
      p.width / 2,
      p.height / 2 - 60,
      {
        size: 120,
        align: p.CENTER,
        color: accent
      }
    );
  }

  if ( state.mode === "recording" && Math.floor( performance.now() / 500 ) % 2 === 0 ) {
    p.push();
    p.noStroke();
    p.fill(
      255,
      60,
      60
    );
    p.circle(
      p.width - HUD_MARGIN - 12,
      HUD_MARGIN + 12,
      20
    );
    p.pop();
  }

  const bottom = [];

  if ( state.message && performance.now() - state.messageAt < 4000 ) {
    bottom.push( state.message );
  }

  if ( state.showHelp ) {
    bottom.push( state.mode === "review"
      ? "R retake · P play/pause · , . step · [ ] close marker · { } open marker · drag timeline to scrub · E download · S save to library (dev) · K keep · N next kept · X back · H help"
      : "R record · 1–9 scenario · drag A/B to place the targets · H help" );
  }

  hud(
    p,
    bottom,
    HUD_MARGIN,
    ( inReview ? timelineRect( p ).y : p.height ) - HUD_MARGIN - bottom.length * 21,
    {
      size: 13,
      alpha: 200
    }
  );
} );
