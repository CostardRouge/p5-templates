import { sketch, string, mappers, easing, animation, colors } from '/assets/scripts/p5-sketches/utils/index.js';

sketch.setup(() => {
    p5.disableFriendlyErrors = true;
}, {
    type: "webgl",
    size: {
      width: 1080,
      height: 1350,
    },
    animation: {
        framerate: 60,
        duration: 6
    },
    // animation: {
    //     framerate: 10,
    //     duration: 2
    // }
});

const text = "54321"

sketch.draw( (time, center, favoriteColor) => {
    background(0);

    const points = animation.ease({
        values:text.split("").map( text => (
            string.getTextPoints({
                text,
                position: createVector(0, 0),
                size: width/1.75,
                font: string.fonts.agiro,
                sampleFactor: .15,
                simplifyThreshold: 0
            })
        )),
        lerpFn: mappers.lerpPoints,
        currentTime: animation.progression*text.length,
        easingFn: easing.easeInOutExpo
    })

    const { x: rX, y: rY, z: rZ } = animation.ease({
        values: [
            // CENTER
            createVector(0, 0, 0),

            // LEFT
            createVector(0, PI/4, 0),

            // BOTTOM
            createVector(PI/4, 0, 0),

            // RIGHT
            createVector(0, -PI/4, 0),

            // TOP
            createVector(-PI/4, 0, 0),
        ],
        currentTime: animation.progression*text.length,
        lerpFn: p5.Vector.lerp,
        easingFn: easing.easeInOutSine
    });

    push()

    rotateX(rX)
    rotateY(rY)
    rotateZ(rZ)

    const depth = 60
    const depthVisibility = 15

    for (let z = 0; z < depth; z++) {
        const depthProgression = -(z/depth)

        if (z >= depthVisibility) {
            return
        }

        push();
        translate( 0, 0, mappers.fn(z, 0, depth, 0, -3000, easing.easeInExpo_ ) )
        // translate( 0, 0, mappers.fn(depthProgression, 0, 1, -500, -1500, easing.easeInOutExpo) )

        // strokeWeight( mappers.fn(z, 0, depth, 10, 5, easing.easeInOutExpo) )
        // strokeWeight( map(z, 0, depth, 10, 50) )
        strokeWeight( map(z, 0, depth, 20, 50) )
        // strokeWeight( 15 )
        //
        for (let i = 0; i < points.length; i++) {
            const progression = i / points.length

            const { x, y } = points[i];
            const colorFunction = colors.rainbow;

            const opacityFactor = mappers.fn(sin(depthProgression*2*PI, easing.easeInOutExpo), -1, 1, 1.75, 1) * Math.pow(1.1, z);

            stroke(colorFunction({
                hueOffset: (
                    +time
                    +0
                ),
                // hueIndex: mappers.fn(noise(x/width, y/height+animation.circularProgression, depthProgression/2), 0, 1, -PI, PI)*14,
                // hueIndex:mappers.fn(noise(x/width, y/height, progression/2+depthProgression/2), 0, 1, -PI, PI)*10,
                // opacityFactor,
                hueIndex:mappers.fn(
                    noise(
                        (x/width)*2,//+mappers.circular(animation.progression, 0, 1, 0, 2, easing.easeInOutSine),
                        (y/height)*1,
                        depthProgression/2+-animation.circularProgression
                    ), 0, 1, -PI, PI)*10,
                opacityFactor: map(depthProgression, 0, 1, 1.15, 1) * Math.pow(1.15, z)
            }))

            const xx = (
                x*mappers.fn(z, 0, depth, 1, 0, easing.easeInExpo)
                +x*Math.pow(1.15, z)
            )

            const yy = (
                y*mappers.fn(z, 0, depth, 1, 0, easing.easeInExpo)
                +y*Math.pow(1.15, z)
            )

            point(xx, yy)
        }
        pop()
    }
    pop()

    orbitControl();
});
