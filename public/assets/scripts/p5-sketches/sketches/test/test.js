import { sketch, mappers, animation, string } from '/assets/scripts/p5-sketches/utils/index.js';

function getCaptureOptions() {
    const urlParams = new URLSearchParams(window.location.search);
    const base64 = urlParams.get("captureOptions");

    if (!base64) {
        return {};
    }

    return JSON.parse(atob(base64))
}

const options = Object.assign(getCaptureOptions(), {
    "size": {
      "width": 1080,
      "height": 1080
    },
    "animation": {
      "framerate": 30,
      "duration": 5
    },
    "texts": {
      "top": "top",
      "bottom": "bottom"
    },
    "colors": {
      "text": [0,0,0],
      "background": [230, 230, 230]
    }
});

let graphic = null;

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

sketch.draw( (time, center, favoriteColor) => {
    // options.colors.text = [252, 209, 83]
    // blendMode(HARD_LIGHT);

    background(...options.colors.background);

    string.write(options.texts.top, width*.1, height*.2, {
        size: 92,
        stroke: color(...options.colors.background),
        fill: color(...options.colors.text, 190),
        font: string.fonts.martian
    })

    string.write(options.texts.bottom, width*.9, height*.8, {
        right: true,
        bottom: true,

        size: 92,
        stroke: color(...options.colors.background),
        fill: color(...options.colors.text, 190),
        font: string.fonts.martian
    })

    graphic.background(...options.colors.background, 120);

    graphic.fill(0);
    graphic.circle(
        mappers.fn(sin(animation.sinAngle), -1, 1, 100, width-100),
        mappers.fn(cos(animation.cosAngle), -1, 1, 100, width-100),
        90
    )

    image(graphic, 0, 0, SCREEN);
    blend(graphic, 0, 0, width, height, 0, 0, width, height, SCREEN);
});
