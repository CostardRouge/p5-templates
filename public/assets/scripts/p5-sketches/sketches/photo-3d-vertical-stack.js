import { sketch, easing, mappers, shapes, imageUtils, exif, animation, string, events, cache, captureOptions as options } from '/assets/scripts/p5-sketches/utils/index.js';

class Card {
    constructor({ position, index }) {
        this.index = index;
        this.position = position;
        this.img = cache.get("images")?.[this.index]?.img;
        this.path = cache.get("images")?.[this.index]?.path;
        this.filename = cache.get("images")?.[this.index]?.filename;
        this.exif = cache.get("images")?.[this.index]?.exif;
    }

    update() {
        // const { x: start, y: end } = this.limits;

        // const stepSize = (end - start) / 360; // Compute step size dynamically
        // const limitsLength = (end-start);
        // const limitUnit = abs(limitsLength)/cardsLength;

        // this.position.y += (
        //     easing.easeInOutExpo(animation.progression)
        // )*stepSize

        // this.position = animation.ease({
        //     values: cache.get("positions"),
        //     currentTime: (
        //         animation.progression*cardsLength
        //         +this.index
        //     ),
        //     easingFn: easing.easeInOutExpo,
        //     lerpFn: p5.Vector.lerp
        // });

        // this.position.y = circularConstrain(this.position.y, start, end)

        this.updatePosition();
    }

    updatePosition() {
        const positions = cache.get("positions");
        const positionsCount = positions.length;

        // Calculate phase progression (0-1 loop) with staggered start per card
        const phase = (animation.progression + this.index / positionsCount) % 1;

        // Get current and next position indices with wrap-around
        const rawIndex = phase * positionsCount;
        this.currentIndex = Math.floor(rawIndex);
        this.nextIndex = (this.currentIndex + 1) % positionsCount;

        // Calculate easing between current and next position
        const t = rawIndex - this.currentIndex;
        const easedT = easing.easeOutSine(t);

        // Lerp between positions
        this.position = p5.Vector.lerp(
            positions[this.currentIndex],
            positions[this.nextIndex],
            easedT
        );

        if (this.nextIndex === 0) {
            this.position = positions[0].copy()
        }
    }

    draw(graphics) {
        if (!this.img) {
            return
        }

        graphics.push()
        graphics.translate(this.position);
        imageUtils.marginImage({
            img: this.img,
            scale: .85,
            center: true,
            graphics,
        });
        graphics.pop();

        if (!this.exif) {
            return
        }

        if (this.currentIndex === options.assets.length-2) {
            const exifInfoText = [
                exif.formatFocalLength(this?.exif?.focalLength),
                exif.formatAperture(this?.exif?.aperture),
                exif.formatShutterSpeed(this?.exif?.shutterSpeed),
                exif.formatISO(this?.exif?.iso),
            ].join(" · ");

            push()
            translate(50, height/2);
            rotate(-PI/2)
            string.write(
                exifInfoText,
                0, 0,
                {
                    // graphics,
                    size: 24,
                    // fill: color(...options.colors.text),
                    // stroke: color(...options.colors.background),

                    stroke: color(...options.colors.text),
                    fill: color(...options.colors.background),

                    font: string.fonts.martian,
                    textAlign: [CENTER, CENTER],
                    blendMode: DIFFERENCE
                }
            )
            pop();
        }
    }
}

const cards = [];
const canvases = {};
const cardsLength = options.assets.length;

sketch.setup(
    () => {
        canvases._3d = createGraphics(
            sketch?.engine?.canvas?.width,
            sketch?.engine?.canvas?.height,
            "webgl"
        );

        background(...options.colors.background);

        const start = createVector(0, height*1/8-height/2, -500);
        const end = createVector(0, height*2.75/4-height/2);

        cache.store("positions", () => (
            Array.from({ length: cardsLength }).map( (_, index) => {
                const position = p5.Vector.lerp(start, end, index/(cardsLength));

                cards.push(new Card({
                    position,
                    index,
                }));

                return position;
            })
        ) );
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

sketch.draw( (_time, center, favoriteColor) => {
    // options.colors.text = [252, 209, 83]
    // background(...options.colors.background);

    // PHOTO 3D SLIDER
    image(canvases._3d, 0, 0, width, height);

    canvases._3d.background(...options.colors.background);
    for (const card of cards) {
        card.update();
        card.draw(canvases._3d);
    }

    push();
    translate(width-50, height/2);
    rotate(PI/2)
    string.write(
        String(Number(animation.progression).toPrecision(3)).slice(0, 5),
        0, 0,
        {
            size: 24,
            fill: color(...options.colors.text),
            stroke: color(...options.colors.background),
            font: string.fonts.martian,
            textAlign: [CENTER, CENTER],
        }
    )
    pop();

    // TEXTS OVER
    const textWriteOptions = {
        size: 172,
        stroke: color(...options.colors.text),
        fill: color(...options.colors.background),

        // stroke: color(0),
        // fill: color(255),
        font: string.fonts.martian,
        textAlign: [CENTER, CENTER],
    }

    string.write(
        options.texts.top || "top",
        width/2,
        animation.ease({
            values: [
                height/2-200,
                height*1/8,
            ],
            currentTime: animation.circularProgression,
            easingFn: easing.easeOutQuint
        }),
        {
            ...textWriteOptions,
            blendMode: EXCLUSION
        }
    )

    string.write(
        options.texts.bottom || "bottom",
        width/2,
        animation.ease({
            values: [
                height/2+200,
                height*6.5/8
            ],
            currentTime: animation.circularProgression,
            easingFn: easing.easeOutQuint
        }),
        {
            ...textWriteOptions,
            blendMode: EXCLUSION
        }
    )

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

    if ( document.querySelector("canvas#defaultCanvas0.loaded") === null && cards.every(card => card.exif !== undefined)) {
        document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
    }
});