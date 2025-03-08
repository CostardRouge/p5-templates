import { sketch, easing, mappers, animation, string, events, cache, captureOptions } from '/assets/scripts/p5-sketches/utils/index.js';

const options = Object.assign( {
    "size": {
      "width": 1080,
      "height": 1920
    },
    "animation": {
      "framerate": 60,
      "duration": 6
    },
    "texts": {
      "top": "top",
      "bottom": "bottom"
    },
    "colors": {
        "text": [0,0,0],
        "accent": [128,128,255],
        "background": [0, 0, 0],
    },
    "lines": true,
    // "durationBar": true,
    "count": 4,
    "assets": [
        "/assets/images/1.jpeg",
        "/assets/images/2.jpeg",
        "/assets/images/3.jpeg",
        "/assets/images/4.jpeg",
        "/assets/images/5.jpeg",
        "/assets/images/6.jpeg",
        "/assets/images/7.jpeg",
        "/assets/images/8.jpeg"

        // "/assets/images/_1.jpeg",
        // "/assets/images/_2.jpeg",
        // "/assets/images/_3.jpeg",
        // "/assets/images/_4.jpeg",
        // "/assets/images/_5.jpeg",
        // "/assets/images/_6.jpeg",
        // "/assets/images/_7.jpeg",
    ]
}, captureOptions);

console.log({captureOptions})

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

    const count = options.count;
    const imageIndexDisplay = ~~(animation.progression * images.length) % images.length;

    const { img, filename } = images[imageIndexDisplay];

    for (let i = 0; i < count; i++) {
        const imageStepIndex = map(animation.linearProgression(images.length), 0, 1, 0, count);

        if (imageStepIndex < i) {
            return;
        }

        const t = i / (count - 1 || 1);
        const scale = lerp(1, 0.7, t);

        // Compute available space (ensuring aspect ratio)
        const availableWidth = width * scale;
        const availableHeight = height * scale;
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;

        let w, h;
        if (imgAspect > canvasAspect) {
            // Image is wider than canvas
            w = availableWidth;
            h = w / imgAspect;
        } else {
            // Image is taller or square
            h = availableHeight;
            w = h * imgAspect;
        }

        // Center the image
        const x = (width - w) / 2;
        const y = (height - h) / 2;

        displayImage(img, x, y, w, h, filename);
    }
});
