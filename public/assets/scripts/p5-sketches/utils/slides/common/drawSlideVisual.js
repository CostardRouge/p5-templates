import visualMaps from "/assets/scripts/p5-sketches/utils/visuals/index.js";

export default function drawSlideVisual(
  visualItemOptions, _slideOptions
) {
  const {
    visual, position
  } = visualItemOptions;

  if ( !visual ) {
    return;
  }

  push();

  translate(
    position.x * width,
    position.y * height
  );
  visualMaps?.[ visual.name ]?.( visual );

  pop();
}