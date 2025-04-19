import { sketch, easing, animation, events, cache, shapes, captureOptions as options, imageUtils } from '/assets/scripts/p5-sketches/utils/index.js';

sketch.setup(
    () => {
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

sketch.draw( (_time, center, favoriteColor) => {
    const images = cache.get("images");

    background(...options.colors.background);

    if (options.lines) {
        stroke(options.colors.accent)

        shapes.hl(0);
        shapes.hl(height);

        shapes.vl(0);
        shapes.vl(width);
    }

    if (options.durationBar) {
        shapes.sketchDurationBar(color(...options.colors.accent))
    }

    const imageIndexDisplay = map(animation.triangleProgression(2), 0, 1, 0, images.length, easing.easeInOutBack);

    const shiftMargin = options.shiftMargin || 80;

    for (let i = 0; i < images.length; i++) {
        if (imageIndexDisplay < i) {
            return;
        }

        const imagePosition = createVector(width/2, height/2);

        if (options.randomPosition || true) {
            imagePosition
              .add(
                map(noise(i), 0, 1, -shiftMargin, shiftMargin),
                map(noise(i), 0, 1, -shiftMargin, shiftMargin),
              )
        }

        imageUtils.marginImage({
            position: imagePosition,
            img: images[i].img,
            center: true,
            margin: 80
        });
    }
});
