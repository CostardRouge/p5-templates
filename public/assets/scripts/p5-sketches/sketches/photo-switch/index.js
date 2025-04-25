import { sketch, easing, mappers, animation, string, imageUtils, events, shapes, cache, captureOptions as options } from '/assets/scripts/p5-sketches/utils/index.js';

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

    const margin = 80;
    const imageIndexDisplay = ~~(animation.progression * images.length) % images.length;

    const { img } = images[imageIndexDisplay];

    imageUtils.marginImage({
        position: createVector(width/2, height/2),
        center: true,
        margin,
        img
    });
});
