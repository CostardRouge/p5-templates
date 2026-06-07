// ─────────────────────────────────────────────────────────────────────────────
// Selectable easing for the GPU sketches.
//
// GLSL has no function pointers, so the noise-field shaders can't take an easing
// function the way the CPU sketches do (mappers.fn(..., easing.easeFoo)). The
// "easing" form control therefore used to be dead on every GPU port — the shader
// baked one fixed curve and ignored the dropdown.
//
// This module closes that gap: EASING_IDS maps each easing key (the same keys as
// utils/easing.js) to a small integer, and EASINGS_GLSL is a GLSL block whose
// applyEasing(int id, float x) dispatches on that integer. A sketch passes
// easingId(key) as an int uniform and calls applyEasing(uId, t) in the shader.
//
// The two halves MUST stay in sync — every key in utils/easing.js has an id
// here, and applyEasing has a branch for every non-zero id. easingIds.test.ts
// guards both directions.
// ─────────────────────────────────────────────────────────────────────────────

// Keys mirror utils/easing.js (plus "linear"). 0 == linear / unknown.
export const EASING_IDS = {
  linear: 0,
  easeInSine: 1,
  easeOutSine: 2,
  easeInOutSine: 3,
  easeInQuad: 4,
  easeOutQuad: 5,
  easeInOutQuad: 6,
  easeInCubic: 7,
  easeOutCubic: 8,
  easeInOutCubic: 9,
  easeInQuart: 10,
  easeOutQuart: 11,
  easeInOutQuart: 12,
  easeInQuint: 13,
  easeOutQuint: 14,
  easeInOutQuint: 15,
  easeInExpo: 16,
  easeOutExpo: 17,
  easeInOutExpo: 18,
  easeInCirc: 19,
  easeOutCirc: 20,
  easeInOutCirc: 21,
  easeInBack: 22,
  easeOutBack: 23,
  easeInOutBack: 24,
  easeInElastic: 25,
  easeOutElastic: 26,
  easeInOutElastic: 27,
  easeInBounce: 28,
  easeOutBounce: 29,
  easeInOutBounce: 30
};

/**
 * The int-uniform payload for an easing key, ready to drop into a render()
 * uniforms object. Unknown / missing keys fall back to linear (0).
 *
 * @param {string} key easing key (e.g. "easeOutQuart"), as stored by the form
 * @returns {{ int: number }}
 */
export function easingId( key ) {
  return {
    int: EASING_IDS[ key ] ?? 0
  };
}

// GLSL ports of the easings missing from MAPPERS_GLSL, plus applyEasing(). This
// block is injected AFTER MAPPERS_GLSL, so it reuses the sine/quad/cubic/back
// curves already defined there and only adds the rest. Polynomial families use
// multiplication rather than pow() for the same reason MAPPERS_GLSL does: the
// mappers feed unclamped inputs (outside 0..1), and pow(negative, n) is
// undefined in GLSL whereas the JS originals use Math.pow with integer
// exponents. exp2(n) == Math.pow(2, n), so the expo/elastic curves match too
// (bar the x==0 / x==1 short-circuits, negligible for these inputs).
export const EASINGS_GLSL = `
  float easeInQuart(float x) { return x * x * x * x; }
  float easeOutQuart(float x) { float u = 1.0 - x; return 1.0 - u * u * u * u; }

  float easeInQuint(float x) { return x * x * x * x * x; }
  float easeOutQuint(float x) { float u = 1.0 - x; return 1.0 - u * u * u * u * u; }
  float easeInOutQuint(float x) {
    if (x < 0.5) { return 16.0 * x * x * x * x * x; }
    float u = -2.0 * x + 2.0;
    return 1.0 - (u * u * u * u * u) / 2.0;
  }

  float easeInExpo(float x) { return exp2(10.0 * x - 10.0); }
  float easeOutExpo(float x) { return 1.0 - exp2(-10.0 * x); }

  float easeInCirc(float x) { return 1.0 - sqrt(1.0 - x * x); }
  float easeOutCirc(float x) { float u = x - 1.0; return sqrt(1.0 - u * u); }
  float easeInOutCirc(float x) {
    if (x < 0.5) {
      float u = 2.0 * x;
      return (1.0 - sqrt(1.0 - u * u)) / 2.0;
    }
    float u = -2.0 * x + 2.0;
    return (sqrt(1.0 - u * u) + 1.0) / 2.0;
  }

  float easeInOutBack(float x) {
    float c1 = 1.70158;
    float c2 = c1 * 1.525;
    if (x < 0.5) {
      float u = 2.0 * x;
      return (u * u * ((c2 + 1.0) * u - c2)) / 2.0;
    }
    float u = 2.0 * x - 2.0;
    return (u * u * ((c2 + 1.0) * u + c2) + 2.0) / 2.0;
  }

  float easeInElastic(float x) {
    float c4 = TAU / 3.0;
    return -exp2(10.0 * x - 10.0) * sin((x * 10.0 - 10.75) * c4);
  }
  float easeOutElastic(float x) {
    float c4 = TAU / 3.0;
    return exp2(-10.0 * x) * sin((x * 10.0 - 0.75) * c4) + 1.0;
  }
  float easeInOutElastic(float x) {
    float c5 = TAU / 4.5;
    if (x < 0.5) {
      return -(exp2(20.0 * x - 10.0) * sin((20.0 * x - 11.125) * c5)) / 2.0;
    }
    return (exp2(-20.0 * x + 10.0) * sin((20.0 * x - 11.125) * c5)) / 2.0 + 1.0;
  }

  float easeOutBounce(float x) {
    float n1 = 7.5625;
    float d1 = 2.75;
    if (x < 1.0 / d1) { return n1 * x * x; }
    if (x < 2.0 / d1) { float u = x - 1.5 / d1; return n1 * u * u + 0.75; }
    if (x < 2.5 / d1) { float u = x - 2.25 / d1; return n1 * u * u + 0.9375; }
    float u = x - 2.625 / d1;
    return n1 * u * u + 0.984375;
  }
  float easeInBounce(float x) { return 1.0 - easeOutBounce(1.0 - x); }
  float easeInOutBounce(float x) {
    if (x < 0.5) { return (1.0 - easeOutBounce(1.0 - 2.0 * x)) / 2.0; }
    return (1.0 + easeOutBounce(2.0 * x - 1.0)) / 2.0;
  }

  // Runtime easing pick. IDs mirror EASING_IDS (JS); 0 / unknown -> linear.
  float applyEasing(int id, float x) {
    if (id == 1) { return easeInSine(x); }
    if (id == 2) { return easeOutSine(x); }
    if (id == 3) { return easeInOutSine(x); }
    if (id == 4) { return easeInQuad(x); }
    if (id == 5) { return easeOutQuad(x); }
    if (id == 6) { return easeInOutQuad(x); }
    if (id == 7) { return easeInCubic(x); }
    if (id == 8) { return easeOutCubic(x); }
    if (id == 9) { return easeInOutCubic(x); }
    if (id == 10) { return easeInQuart(x); }
    if (id == 11) { return easeOutQuart(x); }
    if (id == 12) { return easeInOutQuart(x); }
    if (id == 13) { return easeInQuint(x); }
    if (id == 14) { return easeOutQuint(x); }
    if (id == 15) { return easeInOutQuint(x); }
    if (id == 16) { return easeInExpo(x); }
    if (id == 17) { return easeOutExpo(x); }
    if (id == 18) { return easeInOutExpo(x); }
    if (id == 19) { return easeInCirc(x); }
    if (id == 20) { return easeOutCirc(x); }
    if (id == 21) { return easeInOutCirc(x); }
    if (id == 22) { return easeInBack(x); }
    if (id == 23) { return easeOutBack(x); }
    if (id == 24) { return easeInOutBack(x); }
    if (id == 25) { return easeInElastic(x); }
    if (id == 26) { return easeOutElastic(x); }
    if (id == 27) { return easeInOutElastic(x); }
    if (id == 28) { return easeInBounce(x); }
    if (id == 29) { return easeOutBounce(x); }
    if (id == 30) { return easeInOutBounce(x); }
    return x;
  }
`;
