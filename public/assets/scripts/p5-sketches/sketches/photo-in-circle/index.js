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

console.log(options)

sketch.draw( ( time, center, favoriteColor ) => {
    background(...options.colors.background);

    const images = cache.get("images");

    for (let imageObjectIndex = 0; imageObjectIndex < images.length; imageObjectIndex++ ) {
      const imageObjectIndexProgression = imageObjectIndex / images.length;
      const angle = imageObjectIndexProgression * TAU + (
        map(animation.progression, 0, 1, TAU, 0)
      );

      const imageObjectAtIndex = images[imageObjectIndex];
      const imageAtIndex = imageObjectAtIndex.img;

      const imageAwayPosition = center
        .copy()
        .add(
          sin(angle) * width*0.8,
          cos(angle) * height*.8,
        );

      const imageCenterPosition = center
        .copy()
        .add(
          sin(angle) * width/4,
          cos(angle) * height/4,
        );

      const imagePosition = animation.ease({
        values: [
          imageAwayPosition,
          imageCenterPosition
        ],
        currentTime: (
          animation.circularProgression
          +imageObjectIndexProgression/images.length
        ),
        lerpFn: p5.Vector.lerp,
        easingFn: easing.easeInOutExpo
      })

      push()
      translate(imagePosition.x, imagePosition.y, imageObjectIndex)
      rotate(mappers.fn(noise(imagePosition.x/width/2, imageObjectIndex), 0, 1, -TAU, 0, easing.easeInOutQuint))
      rotate(mappers.fn(animation.triangleProgression(imageObjectIndex), 0, 0, -PI, PI/6, easing.easeInExpo_))
      imageUtils.marginImage({
          img: imageAtIndex,
          scale: mappers.fn(animation.circularProgression, 0, 1, 1, .65, easing.easeInOutQuint),
          center: true,
          // clip: true,
          margin: 80
      });
      pop()
    }

    const defaultTitle = "photo-in-circle".toUpperCase().replaceAll('-', "\n")

    if (animation.progression < 0.6) {
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
