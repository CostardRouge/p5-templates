import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
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
// voronoi v1 — cells.
//
// The classic brute-force Voronoi: every buffer pixel is painted with the colour
// of its nearest site. Optional per-cell shading (darken away from the site) and
// 1-px cell edges (where the nearest-site id changes) give the stained-glass /
// shattered-glass look. The distance metric is fully swappable.
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  sites: [],
  sitesKey: "",
  buffer: null,
  bufW: 0,
  bufH: 0,
  ids: null
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
    state.ids = new Int32Array( bufW * bufH );
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
    renderTitle();

    return;
  }

  const quality = o.quality ?? {};
  const metricFn = METRICS[ quality.metric ?? "euclidean" ] ?? METRICS.euclidean;
  const pexp = quality.minkowskiP ?? 3;

  ensureBuffer( quality.resolution ?? 240 );

  const render = o.render ?? {};
  const paletteName = render.palette ?? "rainbow";

  // Palette lookup is mod 1, so the hue scroll only returns to its start value
  // after a whole number of palette periods per loop — snap the raw speed.
  const hueCycles = Math.round( render.hueSpeed ?? 0 );
  const hueShift = animation.progression * hueCycles;
  const shade = render.shade ?? 0.5;
  const edgeStrength = render.edgeStrength ?? 0.8;
  const edge = render.edgeColor ?? [
    10,
    10,
    14
  ];

  // Per-site flat colours (cheap: one per site, recomputed each frame).
  const siteColors = sites.map( ( site ) =>
    palette(
      paletteName,
      ( site.colorT + hueShift ) % 1
    ) );

  const g = state.buffer;
  const bufW = state.bufW;
  const bufH = state.bufH;
  const ids = state.ids;
  const scaleX = p.width / bufW;
  const scaleY = p.height / bufH;
  const cellNorm = 1 / ( Math.min(
    p.width,
    p.height
  ) * 0.5 );

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

      const id = result.i1;
      const bufIndex = rowBase + x;

      ids[ bufIndex ] = id;

      const rgb = siteColors[ id ] ?? [
        0,
        0,
        0
      ];

      // Shade: darken away from the site centre.
      const dist = quality.metric === "euclidean" ? Math.sqrt( result.d1 ) : result.d1;
      const k = 1 - shade * Math.min(
        1,
        dist * cellNorm
      );

      let r = rgb[ 0 ] * k;
      let gg = rgb[ 1 ] * k;
      let bb = rgb[ 2 ] * k;

      // Cell edges where the nearest site changes vs left / top neighbour.
      const edgeHit = ( x > 0 && ids[ bufIndex - 1 ] !== id )
        || ( y > 0 && ids[ bufIndex - bufW ] !== id );

      if ( edgeHit && edgeStrength > 0 ) {
        r += ( edge[ 0 ] - r ) * edgeStrength;
        gg += ( edge[ 1 ] - gg ) * edgeStrength;
        bb += ( edge[ 2 ] - bb ) * edgeStrength;
      }

      const i = bufIndex * 4;

      px[ i ] = r;
      px[ i + 1 ] = gg;
      px[ i + 2 ] = bb;
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

  if ( render.showSites ) {
    p.noStroke();
    p.fill(
      255,
      255,
      255,
      230
    );

    for ( const site of sites ) {
      p.circle(
        site.x,
        site.y,
        6
      );
    }
  }

  drawInteractionOverlay( interaction );
  renderTitle();
} );
