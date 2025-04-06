import { sketch, easing, mappers, animation, string, events, cache, captureOptions as options } from '/assets/scripts/p5-sketches/utils/index.js';

let graphic = null;

events.register("engine-window-preload", () => {
    cache.store("images", () => options.assets.map( path => ({
        path,
        img: loadImage( path ),
        filename: path.split("/").pop()
    }) ) )
});

sketch.setup(
    () => {
        graphic = createGraphics(options.size.width, options.size.height);

        background(...options.colors.background);
        graphic.background(...options.colors.background);
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

function hl(y) {
    line(0, y, width, y)
}

function vl(x) {
    line(x, 0, x, height)
}

function displayImage(img, x, y, w, h, _text)  {
    image(img, x, y, w, h);

    if (options.lines) {
        stroke(options.colors.accent)

        hl(y);
        hl(y+h);

        vl(x);
        vl(x+w);
    }

    blendMode(DIFFERENCE);
    fill(color(0));
    noStroke();
    textAlign(LEFT, CENTER);
    textSize(64);
    text(_text, x + 64, y + 64);
    blendMode(BLEND);
}

function sketchDurationBar(color) {
    const sketchDurationBarStartPosition = createVector(0, height-2);
    const sketchDurationBarEndPosition = createVector(width, height-2);
    const sketchDurationBarCurrentPosition = p5.Vector.lerp(
        sketchDurationBarStartPosition,
        sketchDurationBarEndPosition,
        animation.progression
    )

    stroke(color);
    strokeWeight(2);
    line(
        sketchDurationBarStartPosition.x,
        sketchDurationBarStartPosition.y,
        sketchDurationBarCurrentPosition.x,
        sketchDurationBarCurrentPosition.y
    );
}

sketch.draw( (_time, center, favoriteColor) => {
    const images = cache.get("images");

    background(...options.colors.background);

    if (options.lines) {
        stroke(options.colors.accent)

        hl(0);
        hl(height);

        vl(0);
        vl(width);
    }

    if (options.durationBar) {
        sketchDurationBar(color(...options.colors.accent))
    }

    const margin = 80;
    const imageIndexDisplay = ~~(animation.progression * images.length) % images.length;

    const { img, filename } = images[imageIndexDisplay];

    // Determine if the image is portrait or landscape
    const isPortrait = img.height > img.width;

    // Apply different margins based on orientation
    const marginX = isPortrait ? margin * 1.5 : margin; // Extra margin for portrait
    const marginY = isPortrait ? margin : margin * 1.5; // Extra margin for landscape

    const availableWidth = width - 2 * marginX;
    const availableHeight = height - 2 * marginY;

    // Scale factor to fit inside the available area
    const scale = Math.min(availableWidth / img.width, availableHeight / img.height);

    // Compute the new dimensions
    const newWidth = img.width * scale;
    const newHeight = img.height * scale;

    // Center the image with the adjusted margins
    const x = (width - newWidth) / 2;
    const y = (height - newHeight) / 2;

    // Draw the image
    displayImage(img, x, y, newWidth, newHeight, filename);
});
