import {
  sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

const canvases = {
};

sketch.setup(
  () => {
    canvases.mask = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    background( ...options.colors.background );
    options.noSmooth && noSmooth();
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    }
  }
);

sketch.draw( (
  time, center, favoriteColor
) => {
  const images = cache.get( "images" );
  const imageSwitchSpeed = 3 / 2;// images.length;
  const imageObject = mappers.circularIndex(
    imageSwitchSpeed * animation.progression * images.length,
    images
  );

  imageUtils.marginImage( {
    img: imageObject.img,
    position: center,
    scale: mappers.fn(
      animation.triangleProgression( 1 ),
      0,
      1,
      1,
      1.5,
      easing.easeInOutElastic
    ),
    center: true,
    fill: true,
  } );

  const text = "ROADTRIP";
  const textFonts = [
    // string.fonts.peix,
    // string.fonts.cloitre,
    // string.fonts.serif,
    string.fonts.agiro,
    // string.fonts.martian,
    // string.fonts.tilt,
    // string.fonts.openSans,
    // string.fonts.multicoloure,
    // string.fonts.sans
  ];
  const textFontSwitchSpeed = 1;// textFonts.length;
  const textFontSize = ( height + width ) / 2;
  const textFont = mappers.circularIndex(
    textFontSwitchSpeed * animation.progression * textFonts.length,
    textFonts
  );

  canvases.mask.clear();

  const points = animation.ease( {
    values: text.split( "" ).map( text => (
      string.getTextPoints( {
        text,
        position: createVector(
          width / 2,
          height / 2,
        ),
        size: textFontSize,
        font: textFont,
        sampleFactor: 1,
        simplifyThreshold: 0
      } )
    ) ),
    lerpFn: mappers.lerpPoints,
    currentTime: 2 * animation.progression * text.length,
    easingFn: easing.easeInOutExpo
  } );

  // canvases.mask.stroke("red")
  // canvases.mask.fill("red")
  // canvases.mask.noFill();
  // canvases.mask.strokeWeight(50);

  canvases.mask.beginShape();
  for ( let i = 0; i < points.length; i++ ) {
    // canvases.mask.rect(points[i].x, points[i].y, 30, 30);
    canvases.mask.vertex(
      points[ i ].x,
      points[ i ].y
    );
  }
  canvases.mask.endShape();

  // string.write(
  // 	"S",
  // 	// mappers.circularIndex(animation.progression*text.length, text.split("")),
  // 	width/2,
  // 	height/2-textFontSize/8,
  // 	{
  // 		size: textFontSize,
  // 		// stroke: color(...options.colors.text),
  // 		fill: color(...options.colors.background),
  // 		font: textFont,
  // 		textAlign: [CENTER, CENTER],
  // 		// blendMode: EXCLUSION,
  // 		graphics: canvases.mask
  // 	}
  // )

  const mask = displayMask(
    window,
    canvases.mask
  );

  background( ...options.colors.background );
  image(
    mask,
    0,
    0
  );
} );

function displayMask(
  source = window, mask
) {
  const maskedImage = source.get();

  maskedImage.mask( mask );

  return maskedImage;
}