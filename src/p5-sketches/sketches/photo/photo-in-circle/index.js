import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const getEasing = (
  name, fallback = easing.easeInOutExpo
) =>
  easing?.[ name ] || fallback;

// ---------- setup/draw ----------
sketch.setup( () => {
  background( ...options.sketch.backgroundColor );
} );

sketch.draw( (
  time, center
) => {
  clear();
  background( ...options.sketch.backgroundColor );

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

  const noiseXDiv = options.sketch?.animation?.noiseXDiv ?? 2; // position.x / (width * divisor)
  const noiseRotFromDeg = options.sketch?.animation?.noiseRotationFromDeg ?? 360;
  const noiseRotToDeg = options.sketch?.animation?.noiseRotationToDeg ?? 0;
  const noiseRotEasingName = options.sketch?.animation?.noiseRotationEasing ?? "easeInOutQuint";

  const centerX = center.x;
  const centerY = center.y;

  for ( let i = 0; i < images.length; i++ ) {
    const imgObj = images[ i ];
    const imageAtIndex = imgObj?.img || imgObj; // be tolerant

    const progression = i / images.length;

    const base = map(
      animation.progression * orbitSpeed,
      0,
      1,
      TAU,
      0
    );
    const angle = progression * TAU + base;

    const away = createVector(
      centerX + sin( angle ) * width * outerRadiusFactor,
      centerY + cos( angle ) * height * outerRadiusFactor
    );

    const near = createVector(
      centerX + sin( angle ) * width * innerRadiusFactor,
      centerY + cos( angle ) * height * innerRadiusFactor
    );

    const pos = animation.ease( {
      values: [
        away,
        near
      ],
      currentTime: animation.circularProgression + progression / images.length,
      lerpFn: p5.Vector.lerp,
      easingFn: easing.easeInOutExpo,
    } );

    push();
    translate(
      pos.x,
      pos.y
    );

    const rotNoise = mappers.fn(
      noise(
        pos.x / ( width * noiseXDiv ),
        i
      ),
      0,
      1,
      radians( noiseRotFromDeg ),
      radians( noiseRotToDeg ),
      getEasing(
        noiseRotEasingName,
        easing.easeInOutQuint
      )
    );

    const rotIndex = mappers.fn(
      progression,
      0,
      1,
      -radians( indexRotDeg ),
      radians( indexRotDeg ),
      getEasing(
        indexRotEasingName,
        easing.easeInExpo
      )
    );

    rotate( rotNoise );
    rotate( rotIndex );

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
      position: createVector(
        0,
        0
      ),
      scale: imgScale,
      margin: width * options.sketch?.margin,
      center: options.sketch?.center ?? true,
      clip: options.sketch?.clip ?? false,
      fill: options.sketch?.fill ?? true,
    } );

    pop();
  }

  renderTitle();
} );
