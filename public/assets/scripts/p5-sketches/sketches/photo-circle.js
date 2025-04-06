import { sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils } from '/assets/scripts/p5-sketches/utils/index.js';

sketch.setup(
    () => {
      background(...options.colors.background);
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

events.register("engine-window-preload", () => {
    cache.store("images", () => options.assets.map( imagePath => ({
          path: imagePath,
          exif: undefined,
          img: loadImage( imagePath ),
          filename: imagePath.split("/").pop(),
    }) ) );

    cache.get("images").forEach( async( imageObject ) => {
        const { path } = imageObject;

        imageObject.exif = await exif.load("http://localhost:3000/" + path);

        console.log(imageObject.exif)
    } );
});

sketch.draw( ( time, center, favoriteColor ) => {
    background(...options.colors.background);

    const images = cache.get("images");

    for (let imageObjectIndex = 0; imageObjectIndex < images.length; imageObjectIndex++ ) {
      const imageObjectIndexProgression = imageObjectIndex / ( images.length -1 );
      const angle = imageObjectIndexProgression * TAU//+ time/2;

      const imageObjectAtIndex = images[imageObjectIndex];
      const imageAtIndex = imageObjectAtIndex.img;

      const imagePosition = center.copy();

      console.log({imageObjectIndexProgression})

      imagePosition.add(
        sin(angle) * width/2,
        cos(angle) * height/2,
      )

      imageUtils.marginImage({
          img: imageAtIndex,
          position: imagePosition,
          scale: 0.25,
          center: true,
      });
    }

    const defaultTitle = "photo-throw.js".toUpperCase().replaceAll('-', "\n")

    if (animation.progression < 0.2) {
        string.write(
            defaultTitle,
            // options.texts.title || defaultTitle,
            width/2,
            height/2,
            {
              size: 128,
              stroke: color(...options.colors.text),
              fill: color(...options.colors.background),
              font: string.fonts.martian,
              textAlign: [CENTER, CENTER],
              blendMode: EXCLUSION
            }
        )
    }

    if ( document.querySelector("canvas#defaultCanvas0.loaded") === null && images.every(image => image.exif !== undefined)) {
        document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
    }
});
