import options from "@/p5/utils/options.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";

import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.setup( () => {
  const p = getP5();

  applyBackground();
} );

function applyBackground() {
  const p = getP5();

  p.background( ...( options.sketch?.backgroundColor ?? [
    255,
    255,
    255
  ] ) );
}

sketch.draw( ( _time ) => {
  const p = getP5();
  const images = imageUtils.getImages();

  applyBackground();

  const count = options.sketch.count;
  const imageIndexes = images.map( (
    _, index
  ) => index );

  const imageIndex = mappers.circularIndex(
    animation.linearProgression() * images.length,
    imageIndexes
  );

  if ( !images[ imageIndex ] ) {
    return;
  }

  const {
    img, filename
  } = images[ imageIndex ];

  const imageStepAnimationProgression = options.sketch.animationProgression;
  const imageStepAnimationProgressionComponent =
    animation?.[ imageStepAnimationProgression ];
  const isImageStepAnimationProgressionComponentFunction =
    typeof imageStepAnimationProgressionComponent === "function";

  const imageStepIndexMapValue =
    isImageStepAnimationProgressionComponentFunction
      ? imageStepAnimationProgressionComponent( images.length )
      : imageStepAnimationProgressionComponent;
  const imageStepMin = options.sketch.zoom ? 1 : 0;
  const imageStepMax = options.sketch.zoom ? 0 : 1;
  const imageStepIndex = p.map(
    imageStepIndexMapValue,
    imageStepMin,
    imageStepMax,
    0,
    count
  );

  for ( let i = 0; i < count; i++ ) {
    if ( imageStepIndex < i ) {
      break;
    }

    const t = i / count;
    const scaleEasingFunction = options.sketch.scaleEasingFunctionName;

    p.push();
    p.translate(
      p.width / 2,
      p.height / 2
    );

    if ( options.sketch.rotate ) {
      p.rotate( p.map(
        i,
        0,
        count,
        0,
        p.PI / 2
      ) );
    }

    imageUtils.marginImage( {
      img,
      position: p.createVector(
        0,
        0
      ),
      center: true,
      fill: true,
      scale: mappers.fn(
        t,
        1,
        Number( options.sketch.scaleStart ),
        Number( options.sketch.scaleEnd ),
        1,
        easing?.[ scaleEasingFunction ]
      ),
    } );

    p.pop();
  }
} );
