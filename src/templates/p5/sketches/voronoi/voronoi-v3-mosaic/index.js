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
// voronoi v3 — stained-glass mosaic.
//
// Flat-coloured cells with thick dark "leading" between them (edges dilated in
// the buffer for a chunky vector look) and optional glowing site points. Hue
// rotation is on by default for a slowly shifting stained-glass window.
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
    8,
    8,
    10,
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
  const metric = quality.metric ?? "euclidean";
  const metricFn = METRICS[ metric ] ?? METRICS.euclidean;
  const pexp = quality.minkowskiP ?? 3;

  ensureBuffer( quality.resolution ?? 240 );

  const render = o.render ?? {};
  const paletteName = render.palette ?? "sunset";

  // Palette lookup is mod 1, so the hue scroll only returns to its start value
  // after a whole number of palette periods per loop — snap the raw speed.
  const hueCycles = Math.round( render.hueSpeed ?? 0.25 );
  const hueShift = animation.progression * hueCycles;
  const shade = render.shade ?? 0.25;
  const edgeWidth = Math.max(
    1,
    Math.round( render.edgeWidth ?? 2 )
  );
  const edge = render.edgeColor ?? [
    6,
    6,
    8
  ];

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

  // Pass 1 — flat (optionally lightly shaded) cell colours + id map.
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
      const dist = metric === "euclidean" ? Math.sqrt( result.d1 ) : result.d1;
      const k = 1 - shade * Math.min(
        1,
        dist * cellNorm
      );
      const i = bufIndex * 4;

      px[ i ] = rgb[ 0 ] * k;
      px[ i + 1 ] = rgb[ 1 ] * k;
      px[ i + 2 ] = rgb[ 2 ] * k;
      px[ i + 3 ] = 255;
    }
  }

  // Pass 2 — dilated leading: any pixel within edgeWidth of a different cell.
  for ( let y = 0; y < bufH; y++ ) {
    const rowBase = y * bufW;

    for ( let x = 0; x < bufW; x++ ) {
      const bufIndex = rowBase + x;
      const id = ids[ bufIndex ];
      let isEdge = false;

      for ( let dy = -edgeWidth; dy <= edgeWidth && !isEdge; dy++ ) {
        const ny = y + dy;

        if ( ny < 0 || ny >= bufH ) {
          continue;
        }

        for ( let dx = -edgeWidth; dx <= edgeWidth; dx++ ) {
          const nx = x + dx;

          if ( nx < 0 || nx >= bufW ) {
            continue;
          }

          if ( ids[ ny * bufW + nx ] !== id ) {
            isEdge = true;
            break;
          }
        }
      }

      if ( isEdge ) {
        const i = bufIndex * 4;

        px[ i ] = edge[ 0 ];
        px[ i + 1 ] = edge[ 1 ];
        px[ i + 2 ] = edge[ 2 ];
      }
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

  // Glowing site points.
  const glow = render.siteGlow ?? 0;

  if ( glow > 0 ) {
    p.push();
    p.blendMode( p.ADD );
    p.noStroke();

    for ( let si = 0; si < sites.length; si++ ) {
      const site = sites[ si ];
      const rgb = siteColors[ si ] ?? [
        255,
        255,
        255
      ];

      for ( let i = 0; i < 3; i++ ) {
        const size = glow * ( 1 + i * 1.6 );
        const alpha = 120 / ( i + 1 );

        p.fill(
          rgb[ 0 ],
          rgb[ 1 ],
          rgb[ 2 ],
          alpha
        );
        p.circle(
          site.x,
          site.y,
          size
        );
      }
    }

    p.pop();
  }

  drawInteractionOverlay( interaction );
  renderTitle();
} );
