/**
 * letter-grid — shared 3D glyph helpers.
 *
 * Turns a character into an extruded, lightable mesh: the glyph outline (outer +
 * holes) sampled once and cached, a tessellated cap, and side walls carrying
 * outward normals so a directional light shades them. Used by every 3D variant of
 * the category (the raised terrain in v2, the leaping letter in v3, …).
 *
 * Conventions shared with the variants' cameras: a glyph point (x, y) maps to the
 * world XZ plane (x→X, y→Z) and the extrusion rises along -Y. The glyph's Y is
 * pre-flipped here so it reads upright under the variants' floor camera (which
 * mirrors screen-X via scale(-1, …)); doing it at the source keeps the wall
 * normals outward for free.
 *
 * `g` is the WEBGL graphics to draw into and `p` the main p5 instance (only used
 * for its drawing-mode constants TESS / TRIANGLES / CLOSE).
 */
import string from "@/p5/utils/string.js";
import {
  splitContours,
  resampleContour
} from "@/p5/utils/letterPaths.js";

// Reference size the glyph outline is sampled at; draw-time scale = letterScale.
export const REF = 100;

// char|sampleFactor → { contours, normals }. Renderer-agnostic (plain points), so
// it survives across graphics instances.
const glyphCache = new Map();
// char|sampleFactor → cap p5.Geometry. Bound to a specific graphics, so it must be
// cleared (clearCapCache) whenever that graphics is recreated.
const capCache = new Map();

// Even-odd point-in-polygon across ALL contours of a glyph (outer + holes), used
// to orient each wall's normal so it faces OUT of the solid.
function pointInContours(
  x, y, contours
) {
  let inside = false;

  for ( const cont of contours ) {
    for ( let i = 0, j = cont.length - 1; i < cont.length; j = i++ ) {
      const xi = cont[ i ].x;
      const yi = cont[ i ].y;
      const xj = cont[ j ].x;
      const yj = cont[ j ].y;
      const intersect = ( yi > y ) !== ( yj > y )
        && x < ( ( xj - xi ) * ( y - yi ) ) / ( yj - yi || 1e-6 ) + xi;

      if ( intersect ) {
        inside = !inside;
      }
    }
  }

  return inside;
}

// Outward horizontal normal per edge of a contour (glyph y maps to world z).
function outwardNormals(
  contour, allContours
) {
  const out = [];
  const step = REF * 0.04;

  for ( let i = 0; i < contour.length; i++ ) {
    const a = contour[ i ];
    const b = contour[ ( i + 1 ) % contour.length ];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(
      ex,
      ey
    ) || 1;
    let nx = ey / len;
    let ny = -ex / len;
    const mx = ( a.x + b.x ) / 2;
    const my = ( a.y + b.y ) / 2;

    if ( pointInContours(
      mx + nx * step,
      my + ny * step,
      allContours
    ) ) {
      nx = -nx;
      ny = -ny;
    }

    out.push( {
      x: nx,
      z: ny
    } );
  }

  return out;
}

function bboxArea( contour ) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for ( const pt of contour ) {
    minX = Math.min(
      minX,
      pt.x
    );
    maxX = Math.max(
      maxX,
      pt.x
    );
    minY = Math.min(
      minY,
      pt.y
    );
    maxY = Math.max(
      maxY,
      pt.y
    );
  }

  return ( maxX - minX ) * ( maxY - minY );
}

// Cached glyph outline: contours (outer first, then holes) + per-edge outward
// normals, sampled once at REF and scaled at draw time.
export function getGlyphGeometry(
  char, font, sampleFactor
) {
  const key = `${ char }|${ sampleFactor }`;
  const cached = glyphCache.get( key );

  if ( cached ) {
    return cached;
  }

  const raw = string.getTextPoints( {
    text: char,
    size: REF,
    font,
    sampleFactor,
    simplifyThreshold: 0
  } );

  let contours = splitContours(
    raw,
    REF * 0.34
  )
    .map( ( c ) => resampleContour(
      c,
      REF * 0.06,
      true
    ) )
    .filter( ( c ) => c.length >= 3 )
    // Flip the glyph's Y (which maps to world Z): the floor camera + the scene's
    // scale(-1,…) leave the glyph readable in X but upside-down along the depth
    // axis, so pre-flip it here. Done before normals so they stay outward.
    .map( ( c ) => c.map( ( pt ) => ( {
      x: pt.x,
      y: -pt.y
    } ) ) );

  if ( contours.length > 1 ) {
    // Outer outline (largest bbox) first; the rest are holes / counters.
    contours = contours
      .map( ( c ) => ( {
        c,
        area: bboxArea( c )
      } ) )
      .sort( (
        a, b
      ) => b.area - a.area )
      .map( ( entry ) => entry.c );
  }

  const geometry = {
    contours,
    normals: contours.map( ( c ) => outwardNormals(
      c,
      contours
    ) )
  };

  glyphCache.set(
    key,
    geometry
  );

  return geometry;
}

// Build a drawable geometry { contours, normals } from arbitrary contour rings
// (outer first, then holes) — e.g. contours produced by morphing one glyph into
// another. Normals are recomputed so the side walls still shade correctly.
export function geometryFromContours( contours ) {
  return {
    contours,
    normals: contours.map( ( c ) => outwardNormals(
      c,
      contours
    ) )
  };
}

// The flat glyph cap, tessellated ONCE per character into a retained geometry
// (in glyph units, at y = 0) and cached. Re-tessellating a cap every frame is the
// cost that matters when many are drawn; with a cached mesh the per-frame work is
// just a model() draw. buildGeometry opens its own shape stream, so call this
// OUTSIDE the scene's transforms/shapes (e.g. a pre-warm pass) — otherwise the
// current camera transform is baked into the mesh.
export function getCapMesh(
  g, p, char, font, sampleFactor
) {
  const key = `${ char }|${ sampleFactor }`;

  if ( capCache.has( key ) ) {
    return capCache.get( key );
  }

  const geometry = getGlyphGeometry(
    char,
    font,
    sampleFactor
  );

  if ( !geometry.contours.length ) {
    capCache.set(
      key,
      null
    );

    return null;
  }

  const mesh = g.buildGeometry( () => {
    g.beginShape( p.TESS );

    const outer = geometry.contours[ 0 ];

    for ( const pt of outer ) {
      g.vertex(
        pt.x,
        0,
        pt.y
      );
    }

    for ( let c = 1; c < geometry.contours.length; c++ ) {
      g.beginContour();

      for ( const pt of geometry.contours[ c ] ) {
        g.vertex(
          pt.x,
          0,
          pt.y
        );
      }

      g.endContour();
    }

    g.endShape( p.CLOSE );
  } );

  capCache.set(
    key,
    mesh
  );

  return mesh;
}

// Drop cap meshes built against a now-stale graphics. Call from a sketch's setup
// when the WEBGL graphics is (re)created.
export function clearCapCache() {
  capCache.clear();
}

// The extruded glyph: a tessellated top cap at -height plus quad side walls down
// to y = 0, each wall carrying its outward normal so the light shades it. `k` is
// the glyph→world scale (letterScale) and `color` the [r, g, b(, a)] fill.
export function drawExtrudedGlyph(
  g, p, geometry, k, height, color
) {
  if ( !geometry.contours.length ) {
    return;
  }

  g.ambientMaterial(
    color[ 0 ],
    color[ 1 ],
    color[ 2 ]
  );
  g.fill(
    color[ 0 ],
    color[ 1 ],
    color[ 2 ]
  );

  // Top cap (with holes).
  g.beginShape( p.TESS );

  const outer = geometry.contours[ 0 ];

  for ( const pt of outer ) {
    g.vertex(
      pt.x * k,
      -height,
      pt.y * k
    );
  }

  for ( let c = 1; c < geometry.contours.length; c++ ) {
    g.beginContour();

    for ( const pt of geometry.contours[ c ] ) {
      g.vertex(
        pt.x * k,
        -height,
        pt.y * k
      );
    }

    g.endContour();
  }

  g.endShape( p.CLOSE );

  // Side walls.
  g.beginShape( p.TRIANGLES );

  for ( let c = 0; c < geometry.contours.length; c++ ) {
    const contour = geometry.contours[ c ];
    const normals = geometry.normals[ c ];
    const n = contour.length;

    for ( let i = 0; i < n; i++ ) {
      const a = contour[ i ];
      const b = contour[ ( i + 1 ) % n ];
      const nm = normals[ i ];
      const ax = a.x * k;
      const az = a.y * k;
      const bx = b.x * k;
      const bz = b.y * k;

      g.normal(
        nm.x,
        0,
        nm.z
      );
      g.vertex(
        ax,
        -height,
        az
      );
      g.vertex(
        bx,
        -height,
        bz
      );
      g.vertex(
        bx,
        0,
        bz
      );
      g.vertex(
        ax,
        -height,
        az
      );
      g.vertex(
        bx,
        0,
        bz
      );
      g.vertex(
        ax,
        0,
        az
      );
    }
  }

  g.endShape();
}

// Build a flat filled outline (outer + holes) at world height `y`, optionally
// offset by (offX, offZ) and scaled about the glyph centre by `scale`. Used to lay
// a glyph-shaped shadow on the ground. The caller sets the fill first.
export function fillOutline(
  g, p, geometry, k, y, offX, offZ, scale
) {
  if ( !geometry.contours.length ) {
    return;
  }

  g.beginShape( p.TESS );

  const outer = geometry.contours[ 0 ];

  for ( const pt of outer ) {
    g.vertex(
      pt.x * k * scale + offX,
      y,
      pt.y * k * scale + offZ
    );
  }

  for ( let c = 1; c < geometry.contours.length; c++ ) {
    g.beginContour();

    for ( const pt of geometry.contours[ c ] ) {
      g.vertex(
        pt.x * k * scale + offX,
        y,
        pt.y * k * scale + offZ
      );
    }

    g.endContour();
  }

  g.endShape( p.CLOSE );
}
