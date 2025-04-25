import { sketch, mappers, animation, colors, grid, easing, string, captureOptions as options, shapes } from '/assets/scripts/p5-sketches/utils/index.js';

const canvases = {};

sketch.setup(
  () => {
    canvases.mask = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );
    background(...options.colors.background);
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    },
  }
);

sketch.draw((time) => {
  background(...options.colors.background);

  const textFontSize = (height+width)/2.3;

  canvases.mask.clear()

  string.write(
    options.title,
    width/2,
    height/2-textFontSize/8,
    {
      size: textFontSize,
      // fill: color(...options.colors.background),
      font: string.fonts?.[options.font],
      textAlign: [CENTER, CENTER],
      // blendMode: EXCLUSION,
      popPush: false,
      graphics: canvases.mask
    }
  )

  const rows = 25;
  const columns = 300;
  const gridOptions = {
    topLeft: createVector( 0, 0 ),
    topRight: createVector( width, 0 ),
    bottomLeft: createVector( 0, height ),
    bottomRight: createVector( width, height ),
    rows,
    columns,
    centered: true
  }
  const scale = 1//((width / columns) + (height / rows) ) / 2;

  noiseDetail(
    3,
    0.45,
  );


  grid.draw(gridOptions, (cellVector, { x, y}) => {
    const xOff = x/width*1.5;
    const yOff = y/height*1.5;
    const angle = mappers.fn(noise(xOff+time/2, yOff/2-time/4), 0, 1, -TAU, TAU, easing.easeInOutSine)
    const weight = mappers.fn(noise(xOff, yOff+y, animation.circularProgression), 0, 1, 150, 200, easing.easeInOutBack)

    const colorFunction = mappers.circularIndex(0, [
      colors.rainbow,
      colors.purple
    ])

    stroke(colorFunction({
      hueOffset: 0,
      hueIndex: angle,// map(angle, -10, 10, -PI, TAU),
      // opacityFactor: map(sin(animation.progression+xOff+yOff), -1, 1, 2.5, 1),
      opacityFactor: mappers.fn(noise(xOff, yOff, animation.circularProgression), 0, 1, 2, 1, easing.easeInOutSine)
    }))

    push();
    translate( cellVector.x, cellVector.y );

    strokeWeight(weight);
    // strokeWeight(50);
    point(
      scale * sin(angle),
      angle * scale * cos(angle+y)
    )
    // point( 0, 0);

    pop();
  })

  const maskedImage = window.get();

  maskedImage.mask(canvases.mask);

  background(...options.colors.background);

  image(maskedImage, 0, 0)
});
