// ── The GL transition catalogue ─────────────────────────────────────────────
//
// One fragment program per transition kind, built from a shared prelude and a
// per-kind body. Two families:
//
//   FIELD effects define `float field( vec2 uv )` — the progress at which a
//   pixel is revealed (0 first, 1 last). The prelude turns it into a mask with
//   the transition's softness and lays the edge light along the frontier: the
//   colour, or a palette ramp swept with the progress. Wipes, irises, blinds,
//   dissolves, radial and luma reveals are all one field each.
//
//   WARP effects define `vec4 transition( vec2 uv )` themselves — pushes,
//   zooms, swirls, cubes, glitches — because what they do to the two pictures
//   is not a mask.
//
// Every kind then goes through the same `grade()`: the film finish (letterbox,
// vignette, grain, chromatic aberration, saturation, contrast, tint,
// scanlines) and the two scenes' camera transforms happen here too, so a
// sequence is one shader pass whatever it is doing.
//
// Effect parameters travel through a small fixed set of generic uniforms
// (uCenter, uAngle, uSoftness, uCount, uCount2, uAmount, uSeed, uMode) that
// `effectUniforms()` fills from the effect's own fields — so adding a kind is
// one GLSL body plus one mapping entry, with no change to the compositor.
//
// GLSL ES 1.00 (WebGL1): no dynamic indexing, no `switch`; the kind is baked
// into the program rather than branched on (see sketches.md on uniform
// branching under software GL).
//
// No p5 and no imports in this module: the schema's SEQUENCE_TRANSITION_KINDS
// and this catalogue's keys are kept in step by a test, not by an import.

export const SEQUENCE_VERTEX_GLSL = `
  precision highp float;

  attribute vec2 aPos;
  varying vec2 vUv;

  void main() {
    // uv with y DOWN, as a canvas: row 0 of the uploaded canvases is the top of
    // the picture, and the effects' "up" is -y like every content item's.
    vUv = vec2( aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5 );
    gl_Position = vec4( aPos, 0.0, 1.0 );
  }
`;

const PRELUDE_GLSL = `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform float uFromValid;   // 0 when there is no outgoing scene
  uniform float uProgress;    // eased transition progress, 0..1
  uniform float uTime;        // loop seconds (grain, jitter)
  uniform vec2  uResolution;  // composite buffer, pixels
  uniform float uRatio;       // width / height
  uniform vec4  uFromXform;   // camera: scale, rotation, offsetX, offsetY
  uniform vec4  uToXform;

  uniform vec3  uColor;       // transition colour (plate / edge light)
  uniform float uGlow;        // edge light width and strength
  uniform sampler2D uRamp;    // palette ramp, 256 × 1
  uniform float uRampOn;

  // Effect parameters (see effectUniforms()).
  uniform vec2  uCenter;
  uniform float uAngle;
  uniform float uSoftness;
  uniform float uCount;
  uniform float uCount2;
  uniform float uAmount;
  uniform float uSeed;
  uniform float uMode;

  // Grade.
  uniform float uLetterbox;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uAberration;
  uniform float uSaturation;
  uniform float uContrast;
  uniform vec3  uTint;
  uniform float uTintAmount;
  uniform float uScanlines;

  const float PI  = 3.141592653589793;
  const float TAU = 6.283185307179586;

  float hash( vec2 p ) {
    return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) + uSeed * 0.731 ) * 43758.5453 );
  }

  float vnoise( vec2 p ) {
    vec2 i = floor( p );
    vec2 f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    float a = hash( i );
    float b = hash( i + vec2( 1.0, 0.0 ) );
    float c = hash( i + vec2( 0.0, 1.0 ) );
    float d = hash( i + vec2( 1.0, 1.0 ) );
    return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
  }

  float fbm( vec2 p ) {
    float v = 0.0;
    float a = 0.5;
    for ( int i = 0; i < 4; i++ ) {
      v += a * vnoise( p );
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  vec2 rot( vec2 v, float a ) {
    float c = cos( a );
    float s = sin( a );
    return vec2( c * v.x - s * v.y, s * v.x + c * v.y );
  }

  // A scene's camera: zoom about the centre, roll in pixel space, then pan.
  vec2 cam( vec2 uv, vec4 x ) {
    vec2 d = uv - 0.5;
    d.x *= uRatio;
    d = rot( d, -x.y ) / max( x.x, 0.01 );
    d.x /= uRatio;
    return d + 0.5 + x.zw;
  }

  bool inside( vec2 uv ) {
    return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
  }

  vec4 tex( sampler2D t, vec2 uv ) {
    if ( uAberration > 0.0 ) {
      vec2 d = ( uv - 0.5 ) * uAberration * 0.02;
      vec4 g = texture2D( t, uv );
      return vec4( texture2D( t, uv + d ).r, g.g, texture2D( t, uv - d ).b, g.a );
    }
    return texture2D( t, uv );
  }

  vec4 getFrom( vec2 uv ) {
    if ( uFromValid < 0.5 ) {
      return vec4( 0.0 );
    }
    return tex( uFrom, cam( uv, uFromXform ) );
  }

  vec4 getTo( vec2 uv ) {
    return tex( uTo, cam( uv, uToXform ) );
  }

  // The edge colour at ramp coordinate x: the palette swept, or the colour.
  vec3 edgeColor( float x ) {
    if ( uRampOn > 0.5 ) {
      return texture2D( uRamp, vec2( fract( x ), 0.5 ) ).rgb;
    }
    return uColor;
  }

  // Blend the two scenes at a revealed-ness field value, with the edge light.
  // \`at\` is where the scenes are sampled (a warp may move it), \`f\` the field
  // value at this pixel.
  vec4 revealAt( vec2 at, float f ) {
    float s = max( uSoftness, 0.002 );
    // Stretched so 0 reveals nothing and 1 everything whatever the softness.
    float pr = uProgress * ( 1.0 + 2.0 * s ) - s;
    float d = pr - f;
    float m = smoothstep( -s, s, d );
    vec4 c = mix( getFrom( at ), getTo( at ), m );

    if ( uGlow > 0.0 ) {
      float w = 0.015 + 0.2 * uGlow;
      float g = exp( -abs( d ) / w ) * uGlow;
      vec3 light = edgeColor( uProgress + d * 2.0 );
      c.rgb += light * g * 1.6;
      c.a = max( c.a, g );
    }

    return c;
  }

  vec4 reveal( vec2 uv, float f ) {
    return revealAt( uv, f );
  }

  // The largest distance from uCenter to a corner, under the iris metric.
  float cornerReach( float metric ) {
    float reach = 0.0;
    for ( int i = 0; i < 4; i++ ) {
      vec2 corner = vec2( i == 1 || i == 3 ? 1.0 : 0.0, i >= 2 ? 1.0 : 0.0 );
      vec2 p = corner - uCenter;
      p.x *= uRatio;
      float d = metric < 0.5 ? length( p ) : ( metric < 1.5 ? abs( p.x ) + abs( p.y ) : max( abs( p.x ), abs( p.y ) ) );
      reach = max( reach, d );
    }
    return max( reach, 0.001 );
  }

  // Film finish.
  vec4 grade( vec4 c, vec2 uv ) {
    if ( uLetterbox > 0.0 && ( uv.y < uLetterbox || uv.y > 1.0 - uLetterbox ) ) {
      return vec4( 0.0, 0.0, 0.0, 1.0 );
    }

    vec3 col = c.rgb;
    float l = dot( col, vec3( 0.299, 0.587, 0.114 ) );

    col = mix( vec3( l ), col, uSaturation );
    col = ( col - 0.5 ) * uContrast + 0.5;

    if ( uTintAmount > 0.0 ) {
      vec3 tinted = col * uTint;
      float lt = dot( tinted, vec3( 0.299, 0.587, 0.114 ) );
      tinted *= l / max( lt, 0.001 );
      col = mix( col, tinted, uTintAmount );
    }

    if ( uVignette > 0.0 ) {
      vec2 q = uv - 0.5;
      q.x *= uRatio;
      col *= 1.0 - uVignette * smoothstep( 0.25, 1.0, length( q ) * 1.25 );
    }

    if ( uGrain > 0.0 ) {
      float g = fract( sin( dot( uv * uResolution + fract( uTime * 7.31 ) * 113.0, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5;
      col += g * uGrain * 0.25;
    }

    if ( uScanlines > 0.0 ) {
      float s = 0.5 + 0.5 * sin( uv.y * uResolution.y * PI );
      col *= 1.0 - uScanlines * 0.35 * s;
    }

    return vec4( clamp( col, 0.0, 1.0 ), c.a );
  }
`;

const MAIN_GLSL = `
  void main() {
    gl_FragColor = grade( transition( vUv ), vUv );
  }
`;

// A field effect: the GLSL of `float field( vec2 uv )`.
const field = ( body ) => ( {
  field: body
} );

// A warp effect: the GLSL of `vec4 transition( vec2 uv )`.
const warp = ( body ) => ( {
  transition: body
} );

/**
 * The catalogue, keyed by SEQUENCE_TRANSITION_KINDS. The generic uniforms each
 * body reads are filled by `effectUniforms()` below.
 */
export const TRANSITION_BODIES = {
  cut: warp( `
    vec4 transition( vec2 uv ) {
      return uProgress < 0.5 ? getFrom( uv ) : getTo( uv );
    }
  ` ),

  fade: warp( `
    vec4 transition( vec2 uv ) {
      return mix( getFrom( uv ), getTo( uv ), uProgress );
    }
  ` ),

  // Through the colour: out to the plate over the first half, in over the second.
  dip: warp( `
    vec4 transition( vec2 uv ) {
      float k = uProgress < 0.5 ? uProgress * 2.0 : 2.0 - uProgress * 2.0;
      vec4 c = uProgress < 0.5 ? getFrom( uv ) : getTo( uv );
      vec3 plate = edgeColor( uProgress );
      return vec4( mix( c.rgb, plate, k ), max( c.a, k ) );
    }
  ` ),

  // A crossfade under a hit of colour that peaks at the cut. uAmount = intensity.
  flash: warp( `
    vec4 transition( vec2 uv ) {
      vec4 c = mix( getFrom( uv ), getTo( uv ), smoothstep( 0.35, 0.65, uProgress ) );
      float k = pow( sin( uProgress * PI ), 2.0 ) * uAmount;
      vec3 plate = edgeColor( uProgress );
      return vec4( mix( c.rgb, plate + 0.4, k ), max( c.a, k ) );
    }
  ` ),

  // uAngle = direction (0 = left to right), uSoftness.
  wipe: field( `
    float field( vec2 uv ) {
      vec2 dir = vec2( cos( uAngle ), sin( uAngle ) );
      float reach = 0.5 * ( abs( dir.x ) + abs( dir.y ) );
      float t = dot( uv - 0.5, dir );
      return ( t + reach ) / max( reach * 2.0, 0.001 );
    }
  ` ),

  // uMode = shape (0 circle, 1 diamond, 2 square, 3 star), uCenter, uSoftness.
  iris: field( `
    float field( vec2 uv ) {
      vec2 p = uv - uCenter;
      p.x *= uRatio;
      float d;
      if ( uMode < 0.5 ) {
        d = length( p );
      } else if ( uMode < 1.5 ) {
        d = abs( p.x ) + abs( p.y );
      } else if ( uMode < 2.5 ) {
        d = max( abs( p.x ), abs( p.y ) );
      } else {
        float a = atan( p.y, p.x );
        d = length( p ) * ( 1.0 + 0.35 * cos( 5.0 * a ) );
      }
      float metric = uMode < 2.5 ? uMode : 0.0;
      return d / ( cornerReach( metric ) * ( uMode > 2.5 ? 1.35 : 1.0 ) );
    }
  ` ),

  // uAngle = direction the pictures move, uMode = 0 push, 1 cover, 2 reveal.
  push: warp( `
    vec4 transition( vec2 uv ) {
      vec2 dir = vec2( cos( uAngle ), sin( uAngle ) );
      if ( uMode < 0.5 ) {
        vec2 q = uv + dir * uProgress;
        if ( inside( q ) ) {
          return getFrom( q );
        }
        return getTo( q - dir );
      }
      if ( uMode < 1.5 ) {
        vec2 q = uv - dir * ( 1.0 - uProgress );
        if ( inside( q ) ) {
          return getTo( q );
        }
        return getFrom( uv );
      }
      vec2 q = uv + dir * uProgress;
      if ( inside( q ) ) {
        return getFrom( q );
      }
      return getTo( uv );
    }
  ` ),

  // uMode = 0 in, 1 out; uAmount; uCenter.
  zoom: warp( `
    vec4 transition( vec2 uv ) {
      float k = smoothstep( 0.15, 0.85, uProgress );
      float zoomIn = uMode < 0.5 ? 1.0 : -1.0;
      vec2 pf = uCenter + ( uv - uCenter ) / ( 1.0 + zoomIn * uAmount * 2.5 * uProgress * ( zoomIn > 0.0 ? 1.0 : -0.6 ) );
      vec2 pt = uCenter + ( uv - uCenter ) * ( 1.0 + zoomIn * uAmount * 0.9 * ( 1.0 - uProgress ) );
      vec4 a = getFrom( clamp( pf, 0.0, 1.0 ) );
      vec4 b = getTo( clamp( pt, 0.0, 1.0 ) );
      vec4 c = mix( a, b, k );
      // A breath of the edge colour at the punch.
      float flash = pow( sin( uProgress * PI ), 6.0 ) * 0.5 * uGlow;
      c.rgb = mix( c.rgb, edgeColor( uProgress ), flash );
      return c;
    }
  ` ),

  // uCount = noise scale, uSoftness.
  dissolve: field( `
    float field( vec2 uv ) {
      vec2 p = uv * uCount;
      p.x *= uRatio;
      float n = fbm( p + uSeed );
      return clamp( ( n - 0.2 ) / 0.6, 0.0, 1.0 );
    }
  ` ),

  // uCount = coarsest cell count.
  pixelate: warp( `
    vec4 transition( vec2 uv ) {
      float k = 1.0 - abs( 2.0 * uProgress - 1.0 );
      float cells = mix( uResolution.x, uCount, pow( k, 0.6 ) );
      vec2 q = ( floor( uv * vec2( cells, cells / uRatio ) ) + 0.5 ) / vec2( cells, cells / uRatio );
      return mix( getFrom( q ), getTo( q ), smoothstep( 0.4, 0.6, uProgress ) );
    }
  ` ),

  // uAmount = intensity, uCount = blocks across.
  glitch: warp( `
    vec4 transition( vec2 uv ) {
      float win = sin( uProgress * PI );
      float step_ = floor( uProgress * 24.0 );
      vec2 grid = vec2( uCount, uCount * 1.5 );
      vec2 block = floor( uv * grid );
      float jx = ( hash( vec2( block.y, step_ ) ) - 0.5 ) * uAmount * 0.35 * win;
      float line = ( hash( vec2( floor( uv.y * 180.0 ), step_ + 7.0 ) ) - 0.5 ) * uAmount * 0.06 * win;
      vec2 q = uv + vec2( jx + line, 0.0 );
      float split = uAmount * 0.02 * win;
      // Each block flips to the arriving scene at its own moment.
      float gate = step( hash( block + step_ * 0.37 ), uProgress );
      vec4 a = vec4( getFrom( q + vec2( split, 0.0 ) ).r, getFrom( q ).g, getFrom( q - vec2( split, 0.0 ) ).b, 1.0 );
      vec4 b = vec4( getTo( q + vec2( split, 0.0 ) ).r, getTo( q ).g, getTo( q - vec2( split, 0.0 ) ).b, 1.0 );
      vec4 c = mix( a, b, gate );
      // Colour bars on the hot blocks.
      float hot = step( 0.92, hash( block + step_ ) ) * win * uGlow;
      c.rgb = mix( c.rgb, edgeColor( hash( block ) ), hot );
      return c;
    }
  ` ),

  // uCount = strips, uAngle = strip direction, uSoftness.
  blinds: field( `
    float field( vec2 uv ) {
      vec2 dir = vec2( cos( uAngle ), sin( uAngle ) );
      float t = dot( uv - 0.5, dir ) + 0.5;
      return fract( t * uCount );
    }
  ` ),

  // uCount = columns, uCount2 = rows, uAmount = stagger, uMode = motion
  // (0 flip, 1 shrink, 2 fall, 3 spin).
  tiles: warp( `
    vec4 transition( vec2 uv ) {
      vec2 grid = vec2( uCount, uCount2 );
      vec2 cell = floor( uv * grid );
      vec2 c = fract( uv * grid ) - 0.5;
      float order = mix( ( cell.x + cell.y * grid.x ) / ( grid.x * grid.y ), hash( cell ), 0.5 );
      float span = 1.0 - uAmount * 0.8;
      float lp = clamp( ( uProgress - order * uAmount * 0.8 ) / max( span, 0.02 ), 0.0, 1.0 );
      if ( lp <= 0.0 ) {
        return getFrom( uv );
      }
      if ( lp >= 1.0 ) {
        return getTo( uv );
      }
      vec3 light = edgeColor( order + uProgress );
      if ( uMode < 0.5 ) {
        float k = cos( lp * PI );
        float ak = max( abs( k ), 0.001 );
        if ( abs( c.y ) > ak * 0.5 ) {
          return getTo( uv );
        }
        vec2 src = ( cell + 0.5 + vec2( c.x, c.y / k ) ) / grid;
        vec4 face = k > 0.0 ? getFrom( src ) : getTo( src );
        face.rgb *= 0.6 + 0.4 * ak;
        face.rgb += light * ( 1.0 - ak ) * uGlow * 0.6;
        return face;
      }
      if ( uMode < 1.5 ) {
        float s = 1.0 - lp;
        if ( max( abs( c.x ), abs( c.y ) ) > s * 0.5 ) {
          return getTo( uv );
        }
        vec4 face = getFrom( ( cell + 0.5 + c / max( s, 0.001 ) ) / grid );
        face.rgb += light * lp * uGlow * 0.5;
        return face;
      }
      if ( uMode < 2.5 ) {
        float drop = lp * lp * ( 1.2 + hash( cell + 3.0 ) );
        vec2 shifted = c + vec2( 0.0, -drop );
        if ( abs( shifted.y ) > 0.5 ) {
          return getTo( uv );
        }
        return getFrom( ( cell + 0.5 + shifted ) / grid );
      }
      float s = 1.0 - lp;
      vec2 r = rot( c, lp * PI ) / max( s, 0.001 );
      if ( max( abs( r.x ), abs( r.y ) ) > 0.5 ) {
        return getTo( uv );
      }
      vec4 face = getFrom( ( cell + 0.5 + r ) / grid );
      face.rgb += light * lp * uGlow * 0.5;
      return face;
    }
  ` ),

  // uCenter, uSoftness, uMode = 1 clockwise, uAngle = start angle.
  radial: field( `
    float field( vec2 uv ) {
      vec2 p = uv - uCenter;
      p.x *= uRatio;
      float a = atan( p.y, p.x ) - uAngle;
      if ( uMode < 0.5 ) {
        a = -a;
      }
      return fract( a / TAU );
    }
  ` ),

  // uCount = rings, uAmount = amplitude, uCenter.
  ripple: warp( `
    vec4 transition( vec2 uv ) {
      vec2 p = uv - uCenter;
      p.x *= uRatio;
      float d = length( p );
      float reach = cornerReach( 0.0 );
      float wave = sin( d / reach * uCount * TAU - uProgress * 10.0 ) * sin( uProgress * PI );
      vec2 n = d > 0.0001 ? p / d : vec2( 0.0 );
      n.x /= uRatio;
      vec2 at = uv + n * wave * uAmount * 0.05;
      float f = d / reach + 0.06 * uAmount * wave;
      return revealAt( at, f );
    }
  ` ),

  // uAmount = strength (turns at the centre), uCenter.
  swirl: warp( `
    vec4 transition( vec2 uv ) {
      vec2 p = uv - uCenter;
      p.x *= uRatio;
      float d = length( p );
      float reach = cornerReach( 0.0 );
      float fall = pow( 1.0 - clamp( d / reach, 0.0, 1.0 ), 2.0 );
      float a = uAmount * TAU * fall * sin( uProgress * PI );
      vec2 q = rot( p, a );
      q.x /= uRatio;
      vec2 at = clamp( q + uCenter, 0.0, 1.0 );
      vec4 c = mix( getFrom( at ), getTo( at ), smoothstep( 0.3, 0.7, uProgress ) );
      float ring = exp( -abs( d / reach - uProgress ) * 12.0 ) * uGlow * sin( uProgress * PI );
      c.rgb += edgeColor( uProgress ) * ring;
      return c;
    }
  ` ),

  // uMode = 0 horizontal, 1 vertical; uAmount = perspective.
  cube: warp( `
    vec4 transition( vec2 uv ) {
      vec2 u = uMode < 0.5 ? uv : uv.yx;
      float t = uProgress;
      float split = 1.0 - t;
      vec4 c;
      if ( u.x < split ) {
        float x = u.x / max( split, 0.0001 );
        float squeeze = 1.0 + uAmount * t * ( 1.0 - x ) * 0.8;
        float y = ( u.y - 0.5 ) * squeeze + 0.5;
        vec2 at = uMode < 0.5 ? vec2( x, y ) : vec2( y, x );
        c = getFrom( clamp( at, 0.0, 1.0 ) );
        c.rgb *= 1.0 - t * 0.6;
      } else {
        float x = ( u.x - split ) / max( t, 0.0001 );
        float squeeze = 1.0 + uAmount * ( 1.0 - t ) * x * 0.8;
        float y = ( u.y - 0.5 ) * squeeze + 0.5;
        vec2 at = uMode < 0.5 ? vec2( x, y ) : vec2( y, x );
        c = getTo( clamp( at, 0.0, 1.0 ) );
        c.rgb *= 0.4 + 0.6 * t;
      }
      float edge = exp( -abs( u.x - split ) * 40.0 ) * uGlow;
      c.rgb += edgeColor( uProgress ) * edge;
      return c;
    }
  ` ),

  // uCount = columns: the outgoing picture melts down column by column.
  doom: warp( `
    vec4 transition( vec2 uv ) {
      float col = floor( uv.x * uCount );
      float delay = hash( vec2( col, 1.0 ) ) * 0.4 + 0.15 * sin( col * 0.7 + uSeed );
      float drop = max( 0.0, uProgress * 1.6 - delay );
      vec2 s = vec2( uv.x, uv.y - drop );
      if ( s.y < 0.0 ) {
        return getTo( uv );
      }
      vec4 c = getFrom( s );
      float lip = exp( -s.y * 30.0 ) * step( 0.001, drop ) * uGlow;
      c.rgb += edgeColor( col / uCount + uProgress ) * lip;
      return c;
    }
  ` ),

  // A film burn: the field is noise, the frontier chars dark before it glows.
  // uCount = noise scale, uSoftness.
  burn: warp( `
    vec4 transition( vec2 uv ) {
      vec2 p = uv * uCount;
      p.x *= uRatio;
      float f = clamp( ( fbm( p + uSeed * 1.7 ) - 0.2 ) / 0.6, 0.0, 1.0 );
      float s = max( uSoftness, 0.002 );
      float pr = uProgress * ( 1.0 + 2.0 * s ) - s;
      float d = pr - f;
      float m = smoothstep( -s * 0.3, s * 0.3, d );
      vec4 c = mix( getFrom( uv ), getTo( uv ), m );
      float char_ = exp( -abs( d + s * 0.6 ) / ( s * 0.8 + 0.01 ) );
      c.rgb *= 1.0 - char_ * 0.9;
      float ember = exp( -abs( d ) / ( 0.01 + 0.12 * uGlow ) ) * ( 0.4 + uGlow );
      c.rgb += ( edgeColor( uProgress + d ) * 1.4 + vec3( 0.6, 0.2, 0.0 ) ) * ember;
      c.a = max( c.a, ember );
      return c;
    }
  ` ),

  // uSoftness, uMode = 1 inverted (dark first).
  luma: field( `
    float field( vec2 uv ) {
      vec4 c = getFrom( uv );
      float l = dot( c.rgb, vec3( 0.299, 0.587, 0.114 ) );
      return uMode > 0.5 ? l : 1.0 - l;
    }
  ` ),

  // uCount = strips, uAngle, uAmount = stagger: alternate strips wipe opposite ways.
  slice: field( `
    float field( vec2 uv ) {
      vec2 dir = vec2( cos( uAngle ), sin( uAngle ) );
      vec2 across = vec2( -dir.y, dir.x );
      float along = dot( uv - 0.5, dir ) / max( abs( dir.x ) + abs( dir.y ), 0.001 ) + 0.5;
      float strip = floor( ( dot( uv - 0.5, across ) / max( abs( across.x ) + abs( across.y ), 0.001 ) + 0.5 ) * uCount );
      float odd = mod( strip, 2.0 );
      float f = mix( along, 1.0 - along, odd );
      return f * ( 1.0 - uAmount * 0.7 ) + hash( vec2( strip, 2.0 ) ) * uAmount * 0.7;
    }
  ` )
};

const FIELD_WRAPPER_GLSL = `
  vec4 transition( vec2 uv ) {
    return reveal( uv, field( uv ) );
  }
`;

/**
 * The complete fragment source for one transition kind (an unknown kind
 * compiles as a fade, so a stale saved value still draws something).
 */
export function fragmentSourceFor( kind ) {
  const body = TRANSITION_BODIES[ kind ] ?? TRANSITION_BODIES.fade;
  const effect = body.field
    ? body.field + FIELD_WRAPPER_GLSL
    : body.transition;

  return PRELUDE_GLSL + effect + MAIN_GLSL;
}

const toRadians = ( degrees ) => ( Number( degrees ) || 0 ) * Math.PI / 180;

const centerOf = ( center ) => [
  Number.isFinite( center?.x ) ? center.x : 0.5,
  Number.isFinite( center?.y ) ? center.y : 0.5
];

const SHAPE_MODES = {
  circle: 0,
  diamond: 1,
  square: 2,
  star: 3
};

const PUSH_MODES = {
  push: 0,
  cover: 1,
  reveal: 2
};

const TILE_MODES = {
  flip: 0,
  shrink: 1,
  fall: 2,
  spin: 3
};

/**
 * The generic uniforms an effect's own fields map onto. Every entry is
 * present (defaults) so a program never reads an unset uniform.
 *
 * @param {object} [effect] a SequenceEffectSchema value
 */
export function effectUniforms( effect = {} ) {
  const uniforms = {
    uCenter: [
      0.5,
      0.5
    ],
    uAngle: 0,
    uSoftness: 0.05,
    uCount: 8,
    uCount2: 8,
    uAmount: 0.5,
    uSeed: 7,
    uMode: 0
  };

  const num = (
    value, fallback
  ) => ( Number.isFinite( Number( value ) ) ? Number( value ) : fallback );

  switch ( effect.kind ) {
    case "flash":
      uniforms.uAmount = num(
        effect.intensity,
        0.85
      );
      break;
    case "wipe":
      uniforms.uAngle = toRadians( effect.angle );
      uniforms.uSoftness = num(
        effect.softness,
        0.08
      );
      break;
    case "iris":
      uniforms.uMode = SHAPE_MODES[ effect.shape ] ?? 0;
      uniforms.uCenter = centerOf( effect.center );
      uniforms.uSoftness = num(
        effect.softness,
        0.05
      );
      break;
    case "push":
      uniforms.uAngle = toRadians( effect.angle );
      uniforms.uMode = PUSH_MODES[ effect.mode ] ?? 0;
      break;
    case "zoom":
      uniforms.uMode = effect.direction === "out" ? 1 : 0;
      uniforms.uAmount = num(
        effect.amount,
        0.6
      );
      uniforms.uCenter = centerOf( effect.center );
      break;
    case "dissolve":
      uniforms.uCount = num(
        effect.scale,
        8
      );
      uniforms.uSoftness = num(
        effect.softness,
        0.15
      );
      uniforms.uSeed = num(
        effect.seed,
        7
      );
      break;
    case "pixelate":
      uniforms.uCount = num(
        effect.cells,
        24
      );
      break;
    case "glitch":
      uniforms.uAmount = num(
        effect.intensity,
        0.7
      );
      uniforms.uCount = num(
        effect.blocks,
        12
      );
      uniforms.uSeed = num(
        effect.seed,
        7
      );
      break;
    case "blinds":
      uniforms.uCount = num(
        effect.count,
        8
      );
      uniforms.uAngle = toRadians( effect.angle ?? 90 );
      uniforms.uSoftness = num(
        effect.softness,
        0.05
      );
      break;
    case "tiles":
      uniforms.uCount = num(
        effect.columns,
        6
      );
      uniforms.uCount2 = num(
        effect.rows,
        8
      );
      uniforms.uAmount = num(
        effect.stagger,
        0.6
      );
      uniforms.uMode = TILE_MODES[ effect.motion ] ?? 0;
      uniforms.uSeed = num(
        effect.seed,
        7
      );
      break;
    case "radial":
      uniforms.uCenter = centerOf( effect.center );
      uniforms.uSoftness = num(
        effect.softness,
        0.04
      );
      uniforms.uMode = effect.clockwise === false ? 0 : 1;
      uniforms.uAngle = toRadians( effect.startAngle );
      break;
    case "ripple":
      uniforms.uCount = num(
        effect.rings,
        10
      );
      uniforms.uAmount = num(
        effect.amplitude,
        0.3
      );
      uniforms.uCenter = centerOf( effect.center );
      break;
    case "swirl":
      uniforms.uAmount = num(
        effect.strength,
        1.5
      );
      uniforms.uCenter = centerOf( effect.center );
      break;
    case "cube":
      uniforms.uMode = effect.axis === "vertical" ? 1 : 0;
      uniforms.uAmount = num(
        effect.perspective,
        0.4
      );
      break;
    case "doom":
      uniforms.uCount = num(
        effect.columns,
        40
      );
      uniforms.uSeed = num(
        effect.seed,
        7
      );
      break;
    case "burn":
      uniforms.uCount = num(
        effect.scale,
        6
      );
      uniforms.uSoftness = num(
        effect.softness,
        0.25
      );
      uniforms.uSeed = num(
        effect.seed,
        7
      );
      break;
    case "luma":
      uniforms.uSoftness = num(
        effect.softness,
        0.1
      );
      uniforms.uMode = effect.invert ? 1 : 0;
      break;
    case "slice":
      uniforms.uCount = num(
        effect.count,
        10
      );
      uniforms.uAngle = toRadians( effect.angle );
      uniforms.uAmount = num(
        effect.stagger,
        0.5
      );
      break;
    default:
      break;
  }

  return uniforms;
}

/** The kinds this catalogue can draw, in declaration order. */
export const TRANSITION_KINDS = Object.keys( TRANSITION_BODIES );
