import { sketch, mappers, animation, string } from '/assets/scripts/p5-sketches/utils/index.js';

function getCaptureOptions() {
    const urlParams = new URLSearchParams(window.location.search);
    const base64 = urlParams.get("captureOptions");

    if (!base64) {
        return null;
    }

    return JSON.parse(atob(base64))
}

const options = getCaptureOptions();

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


sketch.draw( (time, center, favoriteColor) => {
    // options.colors.text = [252, 209, 83]

    background(...options.colors.background);

    string.write(options.texts.top, width*.1, height*.2, {
        size: 92,
        stroke: color(...options.colors.background),
        fill: color(...options.colors.text),
        font: string.fonts.martian
    })

    string.write(options.texts.bottom, width*.9, height*.8, {
        right: true,
        bottom: true,

        size: 92,
        stroke: color(...options.colors.background),
        fill: color(...options.colors.text),
        font: string.fonts.martian
    })

    fill(0);
    // stroke(favoriteColor);

    circle(
        mappers.fn(sin(animation.sinAngle), -1, 1, 100, width-100),
        mappers.fn(cos(animation.cosAngle), -1, 1, 100, width-100),
        90
    )
});
