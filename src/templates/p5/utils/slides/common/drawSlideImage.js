import {
  getAsset
} from "../../common.js";
import imageUtils from "../../imageUtils.js";
import mappers from "../../mappers.js";
import animation from "../../animation.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

export default function drawSlideImage(
  imageOption, slideOptions
) {
  const image = getAsset( imageOption.source );

  if ( !image ) {
    return;
  }

  const imagePosition = createVector(
    width * imageOption.position.x,
    height * imageOption.position.y
  );

  if ( imageOption.animation ) {
    if ( imageOption.animation.name === "noise-floating" ) {
      noiseDetail( ...( imageOption?.animation?.noiseDetail ?? [
        2,
        0.7
      ] ) );

      const imageAngle = noise( animation.angle ) * TAU;

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
    img: image.img,
    // The rectangle actually drawn, for the on-canvas drag's hit-test.
    callback: (
      cx, cy, w, h
    ) => {
      const centered = imageOption.center ?? true;

      reportItemBounds(
        centered ? cx - w / 2 : cx,
        centered ? cy - h / 2 : cy,
        w,
        h
      );
    }
  } );
}
