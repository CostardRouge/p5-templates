import {
  common, imageUtils, mappers, animation
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideImage(
  imageOption, slideOptions
) {
  const images = common.getAssets( slideOptions );

  if ( !images || !images.length ) {
    return;
  }

  const image = images[ imageOption.index ];

  if ( !image ) {
    return;
  }

  const imagePosition = createVector(
    width * imageOption.position.x,
    height * imageOption.position.y
  );

  if ( imageOption.animation ) {
    if ( imageOption.animation.name === "noise-floating" ) {
      noiseDetail( ...imageOption.animation.noiseDetail );

      const imageAngle = noise(
        animation.angle,
        imageOption.index
      ) * TAU;

      imagePosition.add(
        mappers.fn(
          Math.sin( imageAngle ),
          0,
          TAU,
          0,
          imageOption.animation.amplitude
        ),
        mappers.fn(
          Math.cos( imageAngle ),
          0,
          TAU,
          0,
          imageOption.animation.amplitude
        )
      );
    }
  }

  imageUtils.marginImage( {
    position: imagePosition,
    center: imageOption.center ?? true,
    margin: imageOption.margin ?? 80,
    scale: imageOption.scale,
    img: image.img
  } );
}