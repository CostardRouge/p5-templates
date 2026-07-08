import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import {
  initInteraction,
  getPointers
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";
import {
  createSites,
  animateSites,
  combineSites,
  nearestTwo,
  palette,
  METRICS
} from "../_voronoi.js";

// ─────────────────────────────────────────────────────────────────────────────
// voronoi v2 — Worley / cellular noise.
//
// Steve Worley's cellular noise built on the same nearest-site machinery: instead
// of colouring by cell id, colour by the distance(s) to the nearest site(s).
//   • F1      → smooth bubbles (dark at sites, bright at borders).
//   • F2−F1   → the classic cracked-cell / dragon-scale border lines.
//   • F1·F2   → soft rounded cells.
// Map through a palette or keep it greyscale.
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  sites: [],
  sitesKey: "",
  buffer: null,
  bufW: 0,
  bufH: 0
};

function ensureSites( o ) {
  const p = getP5();
  const s = o.sites ?? {};
  const key = [
    s.count,
    s.seed,
    s.layout,
    p.width,
    p.height
  ].join( "-" );

  if ( key !== state.sitesKey ) {
    state.sitesKey = key;
    state.sites = createSites( {
      count: s.count ?? 24,
      seed: s.seed ?? 7,
      layout: s.layout ?? "random",
      width: p.width,
      height: p.height
    } );
  }
}

function ensureBuffer( cols ) {
  const p = getP5();
  const bufW = Math.max(
    16,
    Math.round( cols )
  );
  const bufH = Math.max(
    16,
    Math.round( cols * ( p.height / p.width ) )
  );

  if ( !state.buffer || bufW !== state.bufW || bufH !== state.bufH ) {
    state.buffer = p.createGraphics(
      bufW,
      bufH
    );
    state.buffer.pixelDensity( 1 );
    state.bufW = bufW;
    state.bufH = bufH;
  }
}

const result = {
  i1: -1,
  d1: 0,
  i2: -1,
  d2: 0
};

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  ensureSites( o );

  const s = o.sites ?? {};

  animateSites(
    state.sites,
    {
      mode: s.motionMode ?? "drift",
      angle: animation.angle,
      motion: s.motion ?? 1,
      speed: s.speed ?? 1,
      width: p.width,
      height: p.height
    }
  );

  const interaction = o.interaction ?? {};
  const mix = o.interactionMix ?? {};
  const mixMode = mix.mode ?? "add";
  const pointers = mixMode === "off" ? [] : getPointers( interaction );
  const sites = combineSites(
    state.sites,
    pointers,
    mixMode
  );

  if ( sites.length === 0 ) {
    drawInteractionOverlay( interaction );

    return;
  }

  const quality = o.quality ?? {};
  const metric = quality.metric ?? "euclidean";
  const metricFn = METRICS[ metric ] ?? METRICS.euclidean;
  const pexp = quality.minkowskiP ?? 3;

  ensureBuffer( quality.resolution ?? 240 );

  const render = o.render ?? {};
  const mode = render.mode ?? "f2-f1";
  const paletteName = render.palette ?? "ice";
  const grayscale = render.grayscale ?? false;
  const invert = render.invert ?? false;
  const contrast = render.contrast ?? 1;
  const hueShift = animation.progression * ( render.hueSpeed ?? 0 );
  const scale = render.scale ?? 1;

  // Normalise distances so a typical cell radius maps to ≈1.
  const norm = ( Math.sqrt( sites.length ) / Math.min(
    p.width,
    p.height
  ) ) * 2 * scale;

  const toDist = ( d ) => {
    if ( metric === "euclidean" ) {
      return Math.sqrt( d );
    }

    if ( metric === "minkowski" ) {
      return Math.pow(
        d,
        1 / pexp
      );
    }

    return d;
  };

  const g = state.buffer;
  const bufW = state.bufW;
  const bufH = state.bufH;
  const scaleX = p.width / bufW;
  const scaleY = p.height / bufH;

  g.loadPixels();

  const px = g.pixels;

  for ( let y = 0; y < bufH; y++ ) {
    const wy = y * scaleY;
    const rowBase = y * bufW;

    for ( let x = 0; x < bufW; x++ ) {
      nearestTwo(
        sites,
        x * scaleX,
        wy,
        metricFn,
        pexp,
        result
      );

      const f1 = toDist( result.d1 ) * norm;
      const f2 = toDist( result.d2 ) * norm;

      let v;

      if ( mode === "f1" ) {
        v = f1;
      } else if ( mode === "f2" ) {
        v = f2 * 0.5;
      } else if ( mode === "f1xf2" ) {
        v = f1 * f2;
      } else {
        v = f2 - f1;
      }

      v = Math.min(
        1,
        Math.max(
          0,
          v
        )
      );

      if ( contrast !== 1 ) {
        v = Math.pow(
          v,
          contrast
        );
      }

      if ( invert ) {
        v = 1 - v;
      }

      const i = ( rowBase + x ) * 4;

      if ( grayscale ) {
        const c = v * 255;

        px[ i ] = c;
        px[ i + 1 ] = c;
        px[ i + 2 ] = c;
      } else {
        const rgb = palette(
          paletteName,
          ( v + hueShift ) % 1
        );

        px[ i ] = rgb[ 0 ];
        px[ i + 1 ] = rgb[ 1 ];
        px[ i + 2 ] = rgb[ 2 ];
      }

      px[ i + 3 ] = 255;
    }
  }

  g.updatePixels();

  p.push();
  p.image(
    g,
    0,
    0,
    p.width,
    p.height
  );
  p.pop();

  drawInteractionOverlay( interaction );
} );
