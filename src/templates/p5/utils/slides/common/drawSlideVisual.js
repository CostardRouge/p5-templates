import visualMaps from "../../visuals";
import {
  getP5
} from "../../sketch.js";

export default function drawSlideVisual(
  visualItemOptions, _slideOptions
) {
  const p = getP5();
  const {
    visual,
    position,
    scale: scaleValue,
    rotation: rotationValue
  } = visualItemOptions;

  if ( !visual ) {
    return;
  }

  p.push();

  p.translate(
    position.x * p.width,
    position.y * p.height
  );
  p.scale( scaleValue );
  p.rotate( rotationValue );

  visualMaps?.[ visual.name ]?.( visual );

  p.pop();
}
