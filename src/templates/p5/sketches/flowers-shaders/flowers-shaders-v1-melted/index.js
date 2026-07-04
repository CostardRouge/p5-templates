import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// flowers-shaders v1 — melted.
//
// A GPU re-imagining of "flowers v5 — spiral" (which stays untouched). The CPU
// original walks an eased S-curve path with ~250 lerp steps and, at every step,
// stamps a small cluster of `sides` flowers — each flower a ring of
// `flowerPetals` overlapping circles whose size pulses along the path and whose
// rotation winds up with the step index. In black-and-white that overlap is what
// produced the "shape variations": hundreds of white discs with black outlines
// fusing into intricate, layered petals. Doing that per circle on the CPU each
// frame is the slow part, so here the whole path is rebuilt in a single
// full-screen fragment shader: every pixel re-derives the same circles, unions
// the discs and keeps the one drawn last (highest painter order), exactly like
// torsade-shaders v1 melted does for its spirals.
//
// Colour is reworked into the same iridescent, oil-slick palette as melted: a
// cosine (IQ) spectrum that cycles along the path and shimmers across the width
// of every disc, so the molten flowers read as thin-film / soap-bubble
// iridescence instead of the old flat black-and-white. A radial RGB split adds
// optional chromatic aberration on top, for lens-like colour fringing.
//
// All anchor/easing/path maths that depend only on time (not on the pixel) are
// evaluated on the CPU and handed to the shader as uniforms — so the path
// easing dropdown keeps working bit-for-bit with the original.
//
// ── Performance ──────────────────────────────────────────────────────────────
// A full-screen scan is O(pixels × discs), and the naive version paid two
// trig-heavy rotations per disc per pixel — even for discs on the far side of
// the screen. The hot loop is kept lean without changing a single output pixel:
//
//   • Cluster cull — every disc a path sample stamps lives within a known radius
//     of that sample's path point, so one squared-distance test skips the whole
//     sides×petals inner scan when the pixel is out of range. At typical
//     densities a pixel is near only a handful of the hundreds of samples.
//   • Hoisted trig — the per-frame rotations (outer spin, petal step, ring step)
//     are evaluated once, above the loops, not per disc.
//   • Incremental rotation — the petal ring and the cluster fan are advanced by
//     angle-addition recurrences (pure multiplies), so the inner loops call no
//     sin/cos at all.
//   • Squared-distance reject — discs are rejected on dot(d,d) before the sqrt.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SAMPLES = 512; // upper bound on path lerp samples (matches the slider)
const MAX_SIDES = 16; // matches the "sides" slider max
const MAX_PETALS = 32; // matches the "flower petals" slider max

const FRAGMENT = `
  uniform float uT;
  uniform vec2  uStart;
  uniform vec2  uEnd;
  uniform float uSamples;
  uniform float uStep;
  uniform float uSides;
  uniform float uPetals;
  uniform float uSizeMin;
  uniform float uSizeMax;
  uniform float uRotationSpeed;
  uniform float uWind;            // petal wind-up rate (whole turns per loop)
  uniform float uInnerRotationGain;
  uniform float uBorderWidth;
  uniform float uBorderDarken;

  // Iridescent palette controls (shared vocabulary with torsade-shaders melted).
  uniform float uHueSpeed;        // how fast the spectrum scrolls over time
  uniform float uHueSpread;       // spectral cycles packed into the palette
  uniform float uHuePhase;        // base hue rotation
  uniform float uPathHueShift;    // hue drift from start to end of the path
  uniform float uSideHueShift;    // hue offset between the cluster's flowers
  uniform float uPetalHueShift;   // hue offset between a flower's petals
  uniform float uShimmer;         // oil-slick sheen across each disc's width
  uniform float uSaturation;
  uniform float uBrightness;

  // Chromatic aberration (real RGB channel split, evaluated only when on).
  uniform float uAberration;      // channel separation in pixels
  uniform int   uAberrationMode;  // 0 = radial, 1 = horizontal

  // Oil-slick / thin-film iridescence — identical palette to torsade-shaders v1
  // melted: a cosine (IQ) spectrum with the RGB channels phase-shifted so the
  // hue sweeps cleanly through the rainbow, desaturated toward luma and scaled
  // by brightness.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // Re-stamp every circle the CPU sketch would have drawn and keep the one drawn
  // last (highest painter order) that covers frag — the loops iterate in the
  // original's exact draw order, so "last writer wins" reproduces the overlap.
  //
  // The disc centres are the original's nested transforms, re-associated so the
  // rotations factor out of the inner loops. The CPU stack was
  //   center = vpos + rot(petalOffset + rot(m, flowerRot), outerRot)
  // and since rotation is linear and composes, that is exactly
  //   center = vpos + rot(petalOffset, outerRot) + rot(m, outerRot + flowerRot).
  // The two rotated unit vectors are then swept by angle-addition recurrences.
  vec4 sampleScene(vec2 frag) {
    vec3  bestColor = vec3(0.0);
    float bestMask = 0.0;

    // Per-frame trig, hoisted above every loop (none of it depends on i/s/k).
    float outerRot = -uT * uRotationSpeed;
    float co = cos(outerRot);            // cluster-fan start direction (s = 0)
    float so = sin(outerRot);

    float inc = TAU / uPetals;           // angle between a flower's petals
    float ci = cos(inc);                 // ring-step rotation (advance per k)
    float si = sin(inc);
    float ringSin = sin(inc * 0.5);      // ring start direction = (sin θ, cos θ)
    float ringCos = cos(inc * 0.5);

    float fanStep = TAU / uSides;        // angle between the cluster's flowers
    float cfs = cos(fanStep);            // fan-step rotation (advance per s)
    float sfs = sin(fanStep);

    for (int i = 0; i < ${ MAX_SAMPLES }; i++) {
      if (float(i) >= uSamples) { break; }

      float li = float(i) * uStep;

      // Path position + the original's size pulse (easeInOutExpo → cos remap).
      vec2 vpos = mix(uStart, uEnd, li);
      float sizeRatio = remap(easeInOutExpo(li), 0.0, 1.0, PI, -PI);
      float crossSize = remap(cos(sizeRatio), -1.0, 1.0, uSizeMin, uSizeMax);
      float innerSize = crossSize / uSides;
      float radius = innerSize * ringSin;

      // Discs this small never cover a pixel — skip the whole cluster.
      if (radius < 0.25) { continue; }

      // Cluster bounding-sphere cull: every disc this sample draws lies within
      // (crossSize + innerSize + radius) of vpos, so a pixel farther than that
      // can't be touched — skip the entire s×k scan (and its trig) for it.
      float reach = crossSize + innerSize + radius + 1.0;
      vec2 toV = frag - vpos;

      if (dot(toV, toV) > reach * reach) { continue; }

      // Combined rotation for the petal ring (outer spin + the original's
      // per-step wind-up), evaluated once per surviving sample.
      float totalRot = outerRot + li * PI - uT * uWind + li * uInnerRotationGain;
      float ct = cos(totalRot);
      float st = sin(totalRot);

      // Cluster-fan unit direction, swept by fanStep across s.
      float fx = co;
      float fy = so;

      for (int s = 0; s < ${ MAX_SIDES }; s++) {
        if (float(s) >= uSides) { break; }

        vec2 base = vpos + crossSize * vec2(fx, fy);

        // Ring unit direction (sin θ, cos θ), swept by inc across k.
        float rx = ringSin;
        float ry = ringCos;

        for (int k = 0; k < ${ MAX_PETALS }; k++) {
          if (float(k) >= uPetals) { break; }

          // rot((rx, ry), totalRot) * innerSize — pure multiplies, no trig.
          vec2 local = frag - base - innerSize * vec2(
            rx * ct - ry * st,
            rx * st + ry * ct
          );

          float dd = dot(local, local);
          float rim = radius + 1.0;

          if (dd <= rim * rim) {
            float d = sqrt(dd);
            float mask = 1.0 - smoothstep(radius - 1.0, radius + 1.0, d);

            if (mask > 0.001) {
              float phase = (li * TAU + uT * uHueSpeed
                + li * uPathHueShift
                + float(s) * uSideHueShift
                + float(k) * uPetalHueShift) / TAU;

              vec3 col = iridescent(phase + uShimmer * (d / radius));

              // Darkened rim reproduces the original's black flower outline.
              if (uBorderWidth > 0.0 && radius - d < uBorderWidth) {
                col *= uBorderDarken;
              }

              bestMask = mask;
              bestColor = col;
            }
          }

          // Advance the ring direction by inc (angle-addition, no trig).
          float nrx = rx * ci + ry * si;
          float nry = ry * ci - rx * si;
          rx = nrx;
          ry = nry;
        }

        // Advance the cluster-fan direction by fanStep (angle-addition).
        float nfx = fx * cfs - fy * sfs;
        float nfy = fy * cfs + fx * sfs;
        fx = nfx;
        fy = nfy;
      }
    }

    return vec4(bestColor, bestMask);
  }

  void main() {
    // Top-left origin, matching the p5 2D coordinates the original drew in.
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    if (uAberration < 0.5) {
      gl_FragColor = sampleScene(frag);
      return;
    }

    // Split the red/blue channels along a radial (or horizontal) offset for a
    // lens-like chromatic fringe; green stays centred.
    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize(frag - uResolution * 0.5 + vec2(1e-4));
    vec2 off = dir * uAberration;

    vec4 cr = sampleScene(frag + off);
    vec4 cg = sampleScene(frag);
    vec4 cb = sampleScene(frag - off);

    gl_FragColor = vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));
  }
`;

const flowers = createNoiseFieldRenderer( FRAGMENT );

const resolveEasing = ( name ) => easing[ name ] ?? easing.linear;

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const path = o.path ?? {};
  const flower = o.flower ?? {};
  const colors = o.colors ?? {};
  const aberration = o.aberration ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const timeScale = o.timeScale ?? 1;

  // ── Loop-exact clock ──────────────────────────────────────────────────────
  // animation.angle sweeps exactly TAU per loop, so the loop seam is invisible
  // only when every time-driven rate completes a WHOLE number of cycles per
  // loop. Each raw slider rate (× time scale) is therefore rounded to whole
  // cycles below — fractional rates are what made the last frame disagree with
  // the first.
  const t = animation.angle;

  // Outer cluster spin, and the petal wind-up the original advanced at the raw
  // clock rate — snapped to whole turns per loop.
  const rotationTurns = Math.round( ( flower.rotationSpeed ?? 0.5 ) * timeScale );
  const windTurns = Math.round( timeScale );

  // Hue scroll — whole palette periods (one period = 1 / hueSpread) per loop.
  const hueSpread = colors.hueSpread ?? 1;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * hueSpread );

  // ── Animated start/end anchors — computed on the CPU exactly as flowers v5,
  // so the path easing dropdown keeps behaving identically. ────────────────
  const boundary = path.boundary ?? 150;
  const anchorTimeScale = path.anchorTimeScale ?? 0.25;
  const easingFn = resolveEasing( path.easing ?? "linear" );

  // The ease walks its 3 anchors circularly, so it only returns to the start
  // pose after a whole number of 3-anchor cycles — snap the anchor clock to
  // complete exactly that many per loop.
  const anchorCycles = Math.round( ( p.TAU * timeScale * anchorTimeScale ) / 3 );
  const anchorTime = animation.progression * anchorCycles * 3;

  const start = animation.ease( {
    values: [
      p.createVector(
        boundary,
        boundary
      ),
      p.createVector(
        p.width - boundary,
        boundary
      ),
      p.createVector(
        p.width / 2,
        boundary
      )
    ],
    currentTime: anchorTime,
    duration: 1,
    easingFn,
    lerpFn: mappers.lerpVector
  } );

  const end = animation.ease( {
    values: [
      p.createVector(
        p.width - boundary,
        p.height - boundary
      ),
      p.createVector(
        boundary,
        p.height - boundary
      ),
      p.createVector(
        p.width / 2,
        p.height - boundary
      )
    ],
    currentTime: anchorTime,
    duration: 1,
    easingFn,
    lerpFn: mappers.lerpVector
  } );

  // Path density → sample count. Capped so a tiny step can't blow up the
  // per-pixel loop; beyond the cap the path is sampled more coarsely.
  const pathStep = path.step ?? 1 / 250;
  const samples = Math.min(
    Math.max(
      1,
      Math.round( 1 / pathStep )
    ),
    MAX_SAMPLES
  );

  const sides = Math.min(
    flower.sides ?? 2,
    MAX_SIDES
  );
  const petals = Math.min(
    flower.flowerPetals ?? 5,
    MAX_PETALS
  );

  flowers.render( {
    columns: 1,
    rows: 1,
    uniforms: {
      uT: t,
      uStart: [
        start.x,
        start.y
      ],
      uEnd: [
        end.x,
        end.y
      ],
      uSamples: samples,
      uStep: 1 / samples,
      uSides: sides,
      uPetals: petals,
      uSizeMin: flower.sizeMin ?? 1,
      uSizeMax: flower.sizeMax ?? 500,
      uRotationSpeed: rotationTurns,
      uWind: windTurns,
      uInnerRotationGain: flower.innerRotationGain ?? 10,
      uBorderWidth: flower.borderWidth ?? 0,
      uBorderDarken: flower.borderDarken ?? 0,
      uHueSpeed: hueSpread ? hueCycles / hueSpread : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 0,
      uPathHueShift: colors.pathHueShift ?? 1,
      uSideHueShift: colors.sideHueShift ?? 0,
      uPetalHueShift: colors.petalHueShift ?? 0,
      uShimmer: colors.shimmer ?? 1.5,
      uSaturation: colors.saturation ?? 1,
      uBrightness: colors.brightness ?? 1,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );
} );
