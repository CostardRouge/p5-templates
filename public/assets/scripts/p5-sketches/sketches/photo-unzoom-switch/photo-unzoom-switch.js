import { sketch, easing, string, mappers, animation, events, cache, captureOptions as options } from '/assets/scripts/p5-sketches/utils/index.js';

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

    if (options.lines || false) {
        stroke(options.colors.accent)
        stroke(0)

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

    if (options.lines || false) {
        stroke(options.colors.accent)
        stroke(0)

        hl(0);
        hl(height);

        vl(0);
        vl(width);
    }

    if (options.durationBar || true) {
        sketchDurationBar(color(...options.colors.accent))
    }

    const count = options.count || 5;
    const imageIndexes = images.map( (_, index) => index);

    const imageIndex = mappers.circularIndex(
        (
            animation.linearProgression() * images.length
        ),
        imageIndexes
    )

    const { img, filename } = images[imageIndex];
    const animationTriangleProgression = animation.triangleProgression(images.length);

    for (let i = 0; i < count; i++) {
        const imageStepIndex = map(animationTriangleProgression, 0, 1, 0, count);
        // const imageStepIndex = map(animation.linearProgression(images.length), 0, 1, 0, count);

        if (imageStepIndex < i) {
            break;
        }

        const t = i / count;
        const scale = lerp(1, 0.5, t);
        // const scale = mappers.fn(t, 1, 0, 0.7, 1, easing.easeInSine);

        const screenScale = (height / img.height)
        const h = img.height * screenScale * scale;
        const w = img.width * screenScale * scale;

        // Center the image
        const x = (width - w) / 2;
        const y = (height - h) / 2;

        // if (count-1 === i) {
        //     string.write(
        //         options.texts.title || "BOUNCE",
        //         x+w/2,
        //         y,
        //         // height/2,
        //         {
        //             size: 172*scale,
        //             size: 172,
        //             stroke: color(...options.colors.text),
        //             fill: color(...options.colors.background),
        //             font: string.fonts.martian,
        //             center: true,
        //             blendMode: EXCLUSION
        //         }
        //     )
        //
        //     string.write(
        //         options.texts.title || "BOUNCE",
        //         x+w/2,
        //         y+h,
        //         // height/2,
        //         {
        //             size: 172*scale,
        //             size: 172,
        //             stroke: color(...options.colors.text),
        //             fill: color(...options.colors.background),
        //             font: string.fonts.martian,
        //             center: true,
        //             blendMode: EXCLUSION
        //         }
        //     )
        // }

        displayImage(img, x, y, w, h, filename);
    }

    if (animation.progression < 0.1) {
        string.write(
            options.texts.title || "PHOTO\nSTACK",
            width/2,
            height/2,
            {
                size: 172,
                stroke: color(...options.colors.text),
                fill: color(...options.colors.background),
                font: string.fonts.martian,
                center: true,
                blendMode: EXCLUSION
            }
        )
    }

    if ( document.querySelector("canvas#defaultCanvas0.loaded") === null) {
        document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
    }
});
