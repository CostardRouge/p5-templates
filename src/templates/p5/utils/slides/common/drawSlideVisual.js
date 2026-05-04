import visualMaps from "../../visuals";

export default function drawSlideVisual(
  visualItemOptions, _slideOptions
) {
  const {
    visual,
    position,
    scale: scaleValue,
    rotation: rotationValue
  } = visualItemOptions;

  if ( !visual ) {
    return;
  }

  push();

  translate(
    position.x * width,
    position.y * height
  );
  scale( scaleValue );
  rotate( rotationValue );

  visualMaps?.[ visual.name ]?.( visual );

  pop();
}
