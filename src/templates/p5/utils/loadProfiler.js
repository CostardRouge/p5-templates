// One-shot load profiler. Captures how long a sketch takes to become smooth —
// the page paint milestones, the engine phases (p5 load → setup → first draw),
// and the per-frame jank over the first couple of seconds — then logs a single
// breakdown so "what's taking the time on load" is measured, not guessed.
//
// Purely diagnostic: it only reads timestamps and never touches rendering. The
// phase marks are also emitted via performance.mark(), so they line up in the
// Chrome DevTools Performance panel's "Timings" track when recording a reload.
//
// Pairs with the "[vision warmup]" log (mediapipe.js), which breaks down the
// MediaPipe worker + model load and the first shader-compiling inference.

const FRAME_WINDOW_MS = 2500; // how long after the first draw to sample frames
const SLOW_FRAME_MS = 20; // a frame gap above this counts as jank (≈ <50fps)

const profile = {
  name: "",
  startedAt: 0,
  setupBeginAt: 0,
  setupEndAt: 0,
  firstDrawAt: 0,
  lastFrameAt: 0,
  frames: [], // { index, gap, work }
  logged: false
};

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function mark( name ) {
  if ( typeof performance !== "undefined" && typeof performance.mark === "function" ) {
    try {
      performance.mark( name );
    } catch {
      // marks are best-effort
    }
  }
}

export function markSketchStart( name ) {
  profile.name = name ?? "";
  profile.startedAt = nowMs();
  profile.setupBeginAt = 0;
  profile.setupEndAt = 0;
  profile.firstDrawAt = 0;
  profile.lastFrameAt = 0;
  profile.frames = [];
  profile.logged = false;
  mark( "sketch:start" );
}

export function markSetupBegin() {
  profile.setupBeginAt = nowMs();
  mark( "sketch:setup-begin" );
}

export function markSetupEnd() {
  profile.setupEndAt = nowMs();
  mark( "sketch:setup-end" );
}

// Called once per drawn frame with the main-thread work time spent inside the
// draw handler. Records the frame gap (real frame time, incl. GPU/idle) and the
// work time for the first window, then logs the summary once the window closes.
export function recordFrame( workMs ) {
  const at = nowMs();

  if ( !profile.firstDrawAt ) {
    profile.firstDrawAt = at;
    mark( "sketch:first-draw" );
  }

  const gap = profile.lastFrameAt ? at - profile.lastFrameAt : 0;

  profile.lastFrameAt = at;

  if ( at - profile.firstDrawAt <= FRAME_WINDOW_MS ) {
    profile.frames.push( {
      index: profile.frames.length,
      gap: Math.round( gap ),
      work: Math.round( workMs )
    } );
  } else if ( !profile.logged ) {
    logProfile();
  }
}

function round( value ) {
  return Number.isFinite( value ) ? Math.round( value ) : -1;
}

// Page-level paint + navigation milestones, relative to navigationStart.
function pageMilestones() {
  if ( typeof performance === "undefined" || !performance.getEntriesByType ) {
    return "";
  }

  const nav = performance.getEntriesByType( "navigation" )[ 0 ];
  const paints = performance.getEntriesByType( "paint" );
  const fp = paints.find( ( p ) => p.name === "first-paint" );
  const fcp = paints.find( ( p ) => p.name === "first-contentful-paint" );

  const parts = [];

  if ( nav ) {
    parts.push( `TTFB ${ round( nav.responseStart ) }ms` );
    parts.push( `DOMContentLoaded ${ round( nav.domContentLoadedEventEnd ) }ms` );
    parts.push( `load ${ round( nav.loadEventEnd ) }ms` );
  }

  if ( fp ) {
    parts.push( `first-paint ${ round( fp.startTime ) }ms` );
  }

  if ( fcp ) {
    parts.push( `first-contentful-paint ${ round( fcp.startTime ) }ms` );
  }

  return parts.join( ", " );
}

function frameAnalysis() {
  const frames = profile.frames;

  if ( frames.length === 0 ) {
    return {
      summary: "no frames sampled",
      worst: ""
    };
  }

  // Skip the first frame's gap (it's the setup→first-draw boundary, not a gap).
  const gaps = frames.slice( 1 ).map( ( f ) => f.gap );
  const sorted = [
    ...gaps
  ].sort( (
    a, b
  ) => a - b );
  const median = sorted.length ? sorted[ Math.floor( sorted.length / 2 ) ] : 0;
  const slow = frames.filter( ( f ) => f.index > 0 && f.gap > SLOW_FRAME_MS );

  // When did the jank stop? The last frame whose gap exceeded the threshold.
  const lastSlow = slow.length ? slow[ slow.length - 1 ] : null;
  const lastSlowAt = lastSlow ? round( frameTimeMs( lastSlow.index ) ) : 0;

  // Top 6 worst frames, each with work-vs-gap so main-thread jank (work≈gap)
  // is distinguishable from GPU/contention jank (work≪gap).
  const worst = [
    ...slow
  ]
    .sort( (
      a, b
    ) => b.gap - a.gap )
    .slice(
      0,
      6
    )
    .map( ( f ) => `f${ f.index } gap=${ f.gap }ms work=${ f.work }ms` )
    .join( ", " );

  return {
    summary:
      `${ frames.length } frames in first ${ FRAME_WINDOW_MS / 1000 }s, ` +
      `median gap ${ median }ms, ${ slow.length } slow (>${ SLOW_FRAME_MS }ms), ` +
      ( lastSlow
        ? `last jank at frame ${ lastSlow.index } (~${ lastSlowAt }ms after first draw)`
        : "no jank after the first frame" ),
    worst
  };
}

function frameTimeMs( index ) {
  // Approx time-after-first-draw by summing gaps up to `index`.
  let total = 0;

  for ( let i = 1; i <= index && i < profile.frames.length; i++ ) {
    total += profile.frames[ i ].gap;
  }

  return total;
}

function logProfile() {
  profile.logged = true;

  const p5Load = profile.setupBeginAt
    ? round( profile.setupBeginAt - profile.startedAt )
    : -1;
  const setup = profile.setupEndAt && profile.setupBeginAt
    ? round( profile.setupEndAt - profile.setupBeginAt )
    : -1;
  const startToDraw = profile.firstDrawAt
    ? round( profile.firstDrawAt - profile.startedAt )
    : -1;
  // p5 starts the draw loop without awaiting the async setup(), so the first
  // animated frame usually lands before setup (incl. the vision load) finishes
  // — i.e. the sketch animates *concurrently* with MediaPipe loading.
  const overlap = profile.setupEndAt && profile.firstDrawAt &&
    profile.setupEndAt > profile.firstDrawAt;

  const analysis = frameAnalysis();

  console.info( `[load profile] ${ profile.name }\n` +
      `  page:   ${ pageMilestones() || "n/a" }\n` +
      `  engine: p5 load + canvas ${ p5Load }ms, setup (incl. vision) ${ setup }ms, ` +
      `first draw ${ startToDraw }ms after engine start` +
      ( overlap ? " (draw loop runs during async setup)" : "" ) + "\n" +
      `  frames: ${ analysis.summary }\n` +
      ( analysis.worst ? `  worst:  ${ analysis.worst }\n` : "" ) +
      "  (see [vision warmup] for the MediaPipe worker+model+shader breakdown)" );
}

const loadProfiler = {
  markSketchStart,
  markSetupBegin,
  markSetupEnd,
  recordFrame
};

export default loadProfiler;
