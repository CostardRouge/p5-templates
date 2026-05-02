import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const getEasing = (
  name, fallback = easing.easeInOutExpo
) =>
  easing?.[ name ] || fallback;

// ---------- setup/draw ----------
sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.sketch.backgroundColor );

  const images = imageUtils.getImages();

  if ( !images?.length ) {
    return;
  }

  // Controls from options.ts
  const orbitSpeed = options.sketch?.animation?.orbitSpeed ?? 1;
  const outerRadiusFactor = options.sketch?.animation?.outerRadiusFactor ?? 0.8; // away
  const innerRadiusFactor = options.sketch?.animation?.innerRadiusFactor ?? 0.25; // near

  const scaleStart = options.sketch?.animation?.scaleStart ?? 1.0;
  const scaleEnd = options.sketch?.animation?.scaleEnd ?? 0.65;
  const scaleEasingName = options.sketch?.animation?.scaleEasing ?? "easeInOutQuint";

  const indexRotDeg = options.sketch?.animation?.indexRotationDegrees ?? 180;
  const indexRotEasingName = options.sketch?.animation?.indexRotationEasing ?? "easeInExpo";

  const noiseXDiv = options.sketch?.animation?.noiseXDiv ?? 2; // position.x / (p.width * divisor)
  const noiseRotFromDeg = options.sketch?.animation?.noiseRotationFromDeg ?? 360;
  const noiseRotToDeg = options.sketch?.animation?.noiseRotationToDeg ?? 0;
  const noiseRotEasingName = options.sketch?.animation?.noiseRotationEasing ?? "easeInOutQuint";

  const centerX = center.x;
  const centerY = center.y;

  for ( let i = 0; i < images.length; i++ ) {
    const imgObj = images[ i ];
    const imageAtIndex = imgObj?.img || imgObj; // be tolerant

    const progression = i / images.length;

    const base = p.map(
      animation.progression * orbitSpeed,
      0,
      1,
      p.TAU,
      0
    );
    const angle = progression * p.TAU + base;

    const away = p.createVector(
      centerX + p.sin( angle ) * p.width * outerRadiusFactor,
      centerY + p.cos( angle ) * p.height * outerRadiusFactor
    );

    const near = p.createVector(
      centerX + p.sin( angle ) * p.width * innerRadiusFactor,
      centerY + p.cos( angle ) * p.height * innerRadiusFactor
    );

    const pos = animation.ease( {
      values: [
        away,
        near
      ],
      currentTime: animation.circularProgression + progression / images.length,
      lerpFn: mappers.lerpVector,
      easingFn: easing.easeInOutExpo,
    } );

    p.push();
    p.translate(
      pos.x,
      pos.y
    );

    const rotNoise = mappers.fn(
      p.noise(
        pos.x / ( p.width * noiseXDiv ),
        i
      ),
      0,
      1,
      p.radians( noiseRotFromDeg ),
      p.radians( noiseRotToDeg ),
      getEasing(
        noiseRotEasingName,
        easing.easeInOutQuint
      )
    );

    const rotIndex = mappers.fn(
      progression,
      0,
      1,
      -p.radians( indexRotDeg ),
      p.radians( indexRotDeg ),
      getEasing(
        indexRotEasingName,
        easing.easeInExpo
      )
    );

    p.rotate( rotNoise );
    p.rotate( rotIndex );

    const imgScale = mappers.fn(
      animation.circularProgression,
      0,
      1,
      scaleStart,
      scaleEnd,
      getEasing(
        scaleEasingName,
        easing.easeInOutQuint
      )
    );

    imageUtils.marginImage( {
      img: imageAtIndex,
      position: p.createVector(
        0,
        0
      ),
      scale: imgScale,
      margin: p.width * options.sketch?.margin,
      center: options.sketch?.center ?? true,
      clip: options.sketch?.clip ?? false,
      fill: options.sketch?.fill ?? true,
    } );

    p.pop();
  }

  renderTitle();
} );
