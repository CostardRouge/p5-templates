import { sketch, mappers } from '/assets/scripts/p5-sketches/utils/index.js';

sketch.setup(undefined, {
    size: {
        width: 1080,
        height: 1350,
    },
    animation: {
        framerate: 60,
        duration: 6
    },
});

sketch.draw( (time, center, favoriteColor) => {
    background(255, 64);
    stroke(0)
    circle(mouseX, mouseY, (
        +mappers.circularPolar(mouseX, 0, width, 0, 100)
        +mappers.circularPolar(mouseY, 0, height, 0, 100)
    ))
});
