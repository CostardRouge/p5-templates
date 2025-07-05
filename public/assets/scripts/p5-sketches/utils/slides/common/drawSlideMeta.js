import {
  string, slides
} from "/assets/scripts/p5-sketches/utils/index.js";

export default function drawSlideMeta( metaOption ) {
  const horizontalMargin = metaOption.horizontalMargin || .05;
  const verticalMargin = metaOption.verticalMargin || .05;

  const textStyle = {
    size: 24,
    stroke: color(
      0,
      0,
      0,
      0
    ),
    fill: color( ...metaOption.fill ),
    font: string.fonts.martian,
    textAlign: [
      LEFT,
      LEFT,
    ],
  };

  // top - left;
  string.write(
    metaOption.topLeft,
    width * horizontalMargin,
    height * verticalMargin,
    {
      ...textStyle,
    }
  );

  // top-right
  string.write(
    metaOption.topRight,
    -width * horizontalMargin,
    height * verticalMargin,
    {
      ...textStyle,
      textAlign: [
        RIGHT,
      ]
    }
  );

  // bottom-left
  string.write(
    metaOption.bottomLeft,
    width * horizontalMargin,
    height * ( 1 - verticalMargin ),
    textStyle
  );

  // bottom-right
  // string.write(
  //   `${ slides.index + 1 } / ${ slides.count }`,
  //   -width * horizontalMargin,
  //   height * ( 1 - verticalMargin ),
  //   {
  //     ...textStyle,
  //     textWidth: width - ( 2 * horizontalMargin ),
  //     textAlign: [
  //       RIGHT,
  //     ]
  //   }
  // );

  const slideProgressionLineStartPosition = createVector(
    width * horizontalMargin,
    height - ( height * horizontalMargin ) + 14
  );

  const slideProgressionLineEndPosition = createVector(
    width - ( width * horizontalMargin ),
    height - ( height * horizontalMargin ) + 14
  );

  const slideProgressionLineCurrentPosition = p5.Vector.lerp(
    slideProgressionLineStartPosition,
    slideProgressionLineEndPosition,
    ( slides.index + 1 ) / slides.count
  );

  stroke( 0 );
  line(
    slideProgressionLineStartPosition.x,
    slideProgressionLineStartPosition.y,
    slideProgressionLineCurrentPosition.x,
    slideProgressionLineCurrentPosition.y
  );
}