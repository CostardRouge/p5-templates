import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";

import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";

const sketchState = sketch.state( () => ( {
  threeDimensionGraphics: null
} ) );

sketch.setup( async() => {
  const p = getP5();

  sketchState.threeDimensionGraphics = graphics.createAutoResizableGraphics(
    p.width,
    p.height,
    "webgl"
  );
} );

sketch.draw( (
  time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const g = sketchState.threeDimensionGraphics;

  // ── Tunnel shape ──────────────────────────────────────────────────────────
  const rings = options.sketch.tunnel?.rings ?? 40;
  const segments = options.sketch.tunnel?.segments ?? 32;
  const depthStart = options.sketch.tunnel?.depthStart ?? 0;
  const depthEnd = options.sketch.tunnel?.depthEnd ?? -800;
  const depthEasingFn = easing?.[ options.sketch.tunnel?.depthEasing ] ?? easing.easeInQuad;
  const radiusStart = options.sketch.tunnel?.radiusStart ?? 300;
  const radiusEnd = options.sketch.tunnel?.radiusEnd ?? 50;
  const radiusEasingFn = easing?.[ options.sketch.tunnel?.radiusEasing ] ?? easing.easeInQuad;

  // ── Peaks / spikes ────────────────────────────────────────────────────────
  const layers = options.sketch.peaks?.layers ?? 60;
  const spikeLengthMax = options.sketch.peaks?.spikeLengthMax ?? 120;
  const spikeLengthMin = options.sketch.peaks?.spikeLengthMin ?? 0;
  const spikeDepthEasingFn = easing?.[ options.sketch.peaks?.depthEasing ] ?? easing.easeOutQuad;
  const strokeWeightMin = options.sketch.peaks?.point?.strokeWeightMin ?? 1;
  const strokeWeightMax = options.sketch.peaks?.point?.strokeWeightMax ?? 10;
  const strokeWeightEasingFn = easing?.[ options.sketch.peaks?.point?.strokeWeightEasing ] ?? easing.easeOutCirc;
  const peaksAnimated = options.sketch.peaks?.animated ?? true;
  const peaksAnimSpeed = options.sketch.peaks?.animSpeed ?? 0.2;
  const peaksTime = peaksAnimated ? animation.angle * peaksAnimSpeed : 0;

  // ── Opacity along depth ───────────────────────────────────────────────────
  // Separate from the per-point opacity factor in colors — this fades entire
  // rings as they recede into the tunnel.
  const depthOpacityStart = options.sketch.depthOpacity?.start ?? 1;
  const depthOpacityEnd = options.sketch.depthOpacity?.end ?? 0.1;
  const depthOpacityEasingFn = easing?.[ options.sketch.depthOpacity?.easing ] ?? easing.easeInQuad;

  // ── Rotation ──────────────────────────────────────────────────────────────
  const rotationEnabled = options.sketch.rotation?.enabled ?? true;
  const angleMax = options.sketch.rotation?.angleMax ?? ( p.PI / 32 );
  const xMultiplier = options.sketch.rotation?.xMultiplier ?? 0;
  const yMultiplier = options.sketch.rotation?.yMultiplier ?? 0;
  const zMultiplier = options.sketch.rotation?.zMultiplier ?? 1;

  const rX = rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * xMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;
  const rY = rotationEnabled
    ? mappers.fn(
      p.cos( animation.angle * yMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;
  const rZ = rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * zMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;

  g.rotateX( rX );
  g.rotateY( rY );
  g.rotateZ( rZ );

  // Centre the tunnel at the WebGL origin so it appears on-screen.
  // translate is written after rotate but applied to vertices first,
  // so rotation happens around the tunnel midpoint.
  const tunnelMidZ = ( depthStart + depthEnd ) / 2;

  g.translate(
    0,
    0,
    -tunnelMidZ
  );

  // ── Noise setup ───────────────────────────────────────────────────────────
  const noiseScale = options.sketch.noise?.scale ?? 1.5;

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const noiseXMult = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 1;
  const noiseLayerMult = options.sketch.noise?.layerProgressionMultiplier ?? 0.4;
  const noiseAnimMult = options.sketch.noise?.animMultiplier ?? 0.3;

  // ── Colors ────────────────────────────────────────────────────────────────
  const colorFunction = colors.rainbow;
  const opacityMax = options.sketch.colors?.opacityMax ?? 4;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const progressionMultiplier = options.sketch.colors?.progressionMultiplier ?? 1;
  const layerProgressionMultiplier = options.sketch.colors?.layerProgressionMultiplier ?? 1;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 5;
  const hueDepthMixing = options.sketch.colors?.hueDepthMixing ?? 0.3;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const hueIndexEasingFn = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeOutSine;
  const opacityEasingFn = easing?.[ options.sketch.colors?.opacityEasing ] ?? easing.easeInCirc;

  // ── LOD ───────────────────────────────────────────────────────────────────
  const lodEnabled = options.sketch.lod?.enabled ?? true;
  const lodMinLayers = options.sketch.lod?.minLayers ?? 3;

  // ── Precompute total points for progression ───────────────────────────────
  const totalPoints = rings * segments;

  // ── Draw ──────────────────────────────────────────────────────────────────
  for ( let ring = 0; ring < rings; ring++ ) {
    const ringNorm = rings > 1
      ? ring / ( rings - 1 )
      : 0;

    // Depth position along Z axis (eased)
    const ringZ = mappers.fn(
      ringNorm,
      0,
      1,
      depthStart,
      depthEnd,
      depthEasingFn
    );

    // Radius of this ring (eased from start to end)
    const ringRadius = mappers.fn(
      ringNorm,
      0,
      1,
      radiusStart,
      radiusEnd,
      radiusEasingFn
    );

    // Opacity factor for this ring along depth
    const ringOpacity = mappers.fn(
      ringNorm,
      0,
      1,
      depthOpacityStart,
      depthOpacityEnd,
      depthOpacityEasingFn
    );

    // Spike length scaled by depth
    const spikeLength = mappers.fn(
      ringNorm,
      0,
      1,
      spikeLengthMax,
      spikeLengthMin,
      spikeDepthEasingFn
    );

    // LOD: fewer layers for shorter spikes (farther rings)
    const normalizedSpike = spikeLengthMax > 0
      ? spikeLength / spikeLengthMax
      : 1;
    const effectiveLayers = lodEnabled
      ? Math.max(
        lodMinLayers,
        Math.round( layers * normalizedSpike )
      )
      : layers;

    for ( let seg = 0; seg < segments; seg++ ) {
      const segNorm = seg / segments;
      // Angle around the ring: 0 → 2π
      const theta = segNorm * p.TWO_PI;
      const cosTheta = p.cos( theta );
      const sinTheta = p.sin( theta );

      // Base position on the ring circumference
      const baseX = ringRadius * cosTheta;
      const baseY = ringRadius * sinTheta;

      const progression = ( ring * segments + seg ) / ( totalPoints - 1 );

      // Noise-driven spike amplitude (0→1)
      const spikeNoise = p.noise(
        segNorm * noiseScale * noiseXMult,
        ringNorm * noiseScale * noiseYMult,
        peaksTime
      );

      const currentSpikeLength = spikeLength * spikeNoise;

      // Draw base (on wall) first, tip (toward centre) last.
      // All layers share the same Z, so with GL_LEQUAL depth testing
      // the last-drawn layer wins — drawing tips last keeps them visible.
      for ( let layer = effectiveLayers - 1; layer >= 0; layer-- ) {
        const layerProgression = effectiveLayers > 1
          ? layer / ( effectiveLayers - 1 )
          : 1;

        // layerProgression 0 = tip (centre of tunnel), 1 = base (on ring wall)
        const layerOffset = mappers.fn(
          layerProgression,
          0,
          1,
          currentSpikeLength,
          0,
          spikeDepthEasingFn
        );

        // Scale inward toward tunnel centre (offset reduces radius).
        // Clamp to 0 so spikes never flip past the axis.
        const pointRadius = ringRadius > 0
          ? Math.max(
            0,
            1 - layerOffset / ringRadius
          )
          : 1;
        const px = baseX * pointRadius;
        const py = baseY * pointRadius;
        const pz = ringZ;

        // Stroke weight
        const strokeWeight = mappers.fn(
          layerProgression,
          0,
          1,
          strokeWeightMin,
          strokeWeightMax,
          strokeWeightEasingFn
        );

        // Color noise
        const colorNoise = p.noise(
          segNorm * noiseXMult + rX,
          ringNorm * noiseYMult + rY,
          layerProgression * noiseLayerMult + peaksTime * noiseAnimMult + progression + rZ
        );

        // Mix depth into hue
        const hueNoise = p.lerp(
          colorNoise,
          ringNorm,
          hueDepthMixing
        );

        const opacityFactor = mappers.fn(
          p.sin( colorNoise * p.TAU + progression * progressionMultiplier + layerProgression * layerProgressionMultiplier ),
          -1,
          1,
          opacityMax,
          opacityMin,
          opacityEasingFn
        ) * ringOpacity;

        g.strokeWeight( strokeWeight );
        g.stroke( colorFunction( {
          hueOffset,
          hueIndex: mappers.fn(
            hueNoise,
            0,
            1,
            -p.PI,
            p.PI,
            hueIndexEasingFn
          ) * hueIndexMultiplier,
          opacityFactor
        } ) );

        g.point(
          px,
          py,
          pz
        );
      }
    }
  }

  p.image(
    g,
    0,
    0
  );
  g.clear();
  g.reset();
} );
