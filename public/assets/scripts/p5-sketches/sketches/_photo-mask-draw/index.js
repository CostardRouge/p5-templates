import { sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils } from '/assets/scripts/p5-sketches/utils/index.js';

const canvases = {
	mask: undefined
}

function drawImageWithMask({
	img,
	maskDrawer,
	graphics = window
}) {
	const eraseMode = 1//animation.progression >= .5;

	eraseMode && canvases.mask.erase();
	maskDrawer?.(canvases.mask, eraseMode);
	eraseMode && canvases.mask.noErase();

	const maskedImage = img.get();

	maskedImage.mask(canvases.mask);
	graphics.image(maskedImage, 0, 0, graphics.width, graphics.height);
}

sketch.setup(
	() => {
		canvases.mask = createGraphics(
		    sketch?.engine?.canvas?.width,
		    sketch?.engine?.canvas?.height,
		);

		// canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.075);
		background(...options.colors.background);

		canvases.mask.rect(0, 0, width, height);

		// resetBallPositions();
		options.noSmooth && noSmooth();
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

events.register("engine-window-preload", () => {
	cache.store("images", () => options.assets.slice(0, 5).map( imagePath => ({
		path: imagePath,
		img: loadImage( imagePath ),
		filename: imagePath.split("/").pop(),
		ball: {
			position: createVector(),
			size: random(200, 300, 400),
			vx: random(-1, 1),
			vy: random(-1, 1),
		}
	}) ) );
});

sketch.draw( ( time, center, favoriteColor ) => {
	background(...options.colors.background);

	const imageObjects = cache.get("images");
	const ballsCount = 12;

	const m = mappers.fn(animation.circularProgression, 0, 1, 0, 50, easing.easeInOutExpo);
	const w = width/2;
	const h = height/2;
	const radius = mappers.fn(animation.circularProgression, 0, 1, 10, w-m, easing.easeInOutExpo);
	const size = mappers.fn(animation.circularProgression, 0, 1, 350, 25, easing.easeInOutExpo);

	for (let ballIndex = 0; ballIndex < ballsCount; ballIndex++) {
		const angleProgression = (ballIndex / ballsCount);
		const angle = angleProgression * TAU;
		// const size = mappers.fn(animation.circularProgression, 0, 1, 250, 150, easing.easeInOutExpo);

		// const radiusPhase = mappers.fn(animation.triangleProgression(), 0, 1, 0, ballIndex, easing.easeInOutSine);
		// const radius = mappers.fn(sin(animation.angle+radiusPhase), -1, 1, 10, w-m, easing.easeInOutSine);
		// const size = mappers.fn(sin(animation.angle*2+angleProgression), -1, 1, 250, 150, easing.easeInOutSine);

		// const radius = mappers.fn(, -1, 1, 0, w, easing.easeInOutExpo)

		const ballPosition = createVector(
			sin(angle+animation.progression) * radius,
			cos(angle+animation.progression) * radius,
		)

		ballPosition.add(center)

		drawImageWithMask({
			img: imageObjects[0].img,
			maskDrawer: graphics => {
				graphics.fill(255);
				graphics.noStroke();
				graphics.circle(ballPosition.x, ballPosition.y, size)
			}
		})
	}

	const defaultTitle = "photo-draw".toUpperCase().replaceAll('-', "\n")

	if (animation.progression < 0.2) {
		string.write(
			defaultTitle,
			// options.texts.title || defaultTitle,
			width/2,
			height/2,
			{
				size: 128,
				stroke: color(...options.colors.text),
				fill: color(...options.colors.background),
				font: string.fonts.martian,
				textAlign: [CENTER, CENTER],
				blendMode: EXCLUSION
			}
		)
	}

	if ( document.querySelector("canvas#defaultCanvas0.loaded") === null) {
		document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
	}
});
