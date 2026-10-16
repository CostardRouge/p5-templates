// ─────────────────────────────────────────────────────────────────────────────
// The background (backgroundSpec.js) inside a fragment shader, for the shaders
// that paint their own background — a ray that misses, fog fading into it, a
// vignette — rather than letting the 2D canvas under them show through.
// `backgroundUniforms()` (background.js) fills the uniforms: the same 25 stops
// and the same geometry the 2D painter lays, in the canvas's own pixels.
//
//   vec3 bg = backgroundAt(vec2(vUv.x, 1.0 - vUv.y));   // uv with y DOWN
//
// A plain colour is kind 0 and every stop is that colour, so a sketch whose
// background never left the colour picker gets exactly the colour it had.
// The stops are walked in a constant-bound loop: GLSL ES 1.00 only promises
// constant-index access to a uniform array in a fragment shader.
// ─────────────────────────────────────────────────────────────────────────────

export const BACKGROUND_GLSL = `
  uniform float uBgKind;          // 0 colour, 1 linear, 2 radial
  uniform vec4  uBgStops[25];     // RGBA 0–1, evenly spaced from 0 to 1
  uniform vec4  uBgLine;          // linear: from (x, y) to (x, y), pixels, y down
  uniform vec3  uBgCircle;        // radial: centre (x, y) and radius, pixels
  uniform vec2  uBgSize;          // canvas size, pixels

  vec3 backgroundAt(vec2 uvDown) {
    if (uBgKind < 0.5) {
      return uBgStops[0].rgb;
    }

    vec2 p = uvDown * uBgSize;
    float t;

    if (uBgKind < 1.5) {
      vec2 d = uBgLine.zw - uBgLine.xy;
      t = dot(p - uBgLine.xy, d) / max(dot(d, d), 1e-6);
    } else {
      t = length(p - uBgCircle.xy) / max(uBgCircle.z, 1e-6);
    }

    float s = clamp(t, 0.0, 1.0) * 24.0;
    vec3 colour = uBgStops[0].rgb;

    for (int k = 0; k < 24; k++) {
      if (s >= float(k)) {
        colour = mix(uBgStops[k].rgb, uBgStops[k + 1].rgb, clamp(s - float(k), 0.0, 1.0));
      }
    }

    return colour;
  }
`;
