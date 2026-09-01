import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import iterators from "@/p5/utils/iterators.js";
import animation from "@/p5/utils/animation.js";

import {
  cross,
  flower
} from "@/p5/sketches/flowers/_cross.js";

const EASING_FUNCTIONS = {
  linear: easing.linear,
  easeInQuad: easing.easeInQuad,
  easeOutQuad: easing.easeOutQuad,
  easeInOutQuad: easing.easeInOutQuad,
  easeInCubic: easing.easeInCubic,
  easeOutCubic: easing.easeOutCubic,
  easeInOutCubic: easing.easeInOutCubic,
  easeInExpo: easing.easeInExpo,
  easeOutExpo: easing.easeOutExpo,
  easeInOutExpo: easing.easeInOutExpo,
  easeInElastic: easing.easeInElastic,
  easeOutElastic: easing.easeOutElastic,
  easeInOutElastic: easing.easeInOutElastic,
  easeInBounce: easing.easeInBounce,
  easeOutBounce: easing.easeOutBounce,
  easeInOutBounce: easing.easeInOutBounce
};

const resolveEasing = ( name ) => EASING_FUNCTIONS[ name ] ?? easing.easeOutBounce;

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();

  const bg = options.sketch.backgroundColor ?? [
    255
  ];

  p.clear();
  p.background( ...bg );

  const t = animation.angle * ( options.sketch.timeScale ?? 1 );

  // ── Animated start/end via easing ease() ─────────────────────────
  const boundary = options.sketch.path?.boundary ?? 150;
  const anchorTimeScale = options.sketch.path?.anchorTimeScale ?? 0.25;
  const easingFn = resolveEasing( options.sketch.path?.easing ?? "easeOutBounce" );

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
    currentTime: t * anchorTimeScale,
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
    currentTime: t * anchorTimeScale,
    duration: 1,
    easingFn,
    lerpFn: mappers.lerpVector
  } );

  const pathStep = options.sketch.path?.step ?? 1 / 250;
  const sides = options.sketch.foreground?.sides ?? 3;
  const flowerPetals = options.sketch.foreground?.flowerPetals ?? 5;
  const sizeMin = options.sketch.foreground?.sizeMin ?? 1;
  const sizeMax = options.sketch.foreground?.sizeMax ?? 500;
  const borderColor = options.sketch.foreground?.borderColor ?? "black";
  const backgroundColor = options.sketch.foreground?.fillColor ?? "white";
  const borderWidth = options.sketch.foreground?.borderWidth ?? 4;
  const rotationSpeed = options.sketch.foreground?.rotationSpeed ?? 0.5;
  const innerRotationGain = options.sketch.foreground?.innerRotationGain ?? 10;

  iterators.vector(
    start,
    end,
    pathStep,
    (
      vector, lerpIndex
    ) => {
      const sizeRatio = mappers.fn(
        lerpIndex,
        0,
        1,
        p.PI,
        -p.PI,
        easing.easeInOutExpo
      );
      const crossSize = mappers.fn(
        p.cos( sizeRatio ),
        -1,
        1,
        sizeMin,
        sizeMax
      );

      p.push();
      p.translate(
        vector.x,
        vector.y
      );
      p.rotate( -t * rotationSpeed );

      cross( {
        sides,
        borderColor,
        backgroundColor,
        size: crossSize,
        depth: 1,
        recursive: true,
        borderWidth,
        prepareRecursionOptions: () => ( {
          borderWidth,
          sides: 1
        } ),
        draw: (
          index, step, {
            size
          }
        ) => {
          p.rotate( mappers.fn(
            lerpIndex,
            0,
            1,
            0,
            p.PI
          ) );
          p.rotate( -t + lerpIndex * innerRotationGain );
          flower(
            size,
            flowerPetals
          );
        }
      } );
      p.pop();
    }
  );
} );
