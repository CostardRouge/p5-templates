import { sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils } from '/assets/scripts/p5-sketches/utils/index.js';

function resetBallPositions() {
	cache.get("images").forEach( ({ img, ball }) => {
		ball.position.set(width/2, height/2);
		ball.size = random(200, 300, 400, 600)*1.5;
		ball.vx = random(-1, 1);
		ball.vy = random(-1, 1);
	})
}

const canvases = {
	mask: undefined,
	imageBuffer: undefined,
}

function drawImageWithMask({
	img,
	maskDrawer,
	graphics = window
}) {
	imageUtils.marginImage({
		img,
		fill: true,
		center: true,
		graphics: canvases.imageBuffer,
		position: createVector(width/2, height/2),
	});

	// Clean mask
	canvases.mask.erase();
	canvases.mask.rect(0, 0, graphics.width, graphics.height);
	canvases.mask.noErase();

	canvases.mask.background(...options.colors.background, 1);

	maskDrawer?.(canvases.mask);

	const maskedImage = canvases.imageBuffer.get();

	maskedImage.mask(canvases.mask);

	graphics.image(maskedImage, 0, 0, graphics.width, graphics.height);
}

sketch.setup(
	() => {
		canvases.mask = createGraphics(
		    sketch?.engine?.canvas?.width,
		    sketch?.engine?.canvas?.height,
		);

		canvases.imageBuffer = createGraphics(
		    sketch?.engine?.canvas?.width,
		    sketch?.engine?.canvas?.height,
		);

		// canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.075);
		background(...options.colors.background);

		resetBallPositions();
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

	const links = [];

	imageObjects.forEach(({ ball }, index) => {
		const { size, position, vx, vy } = ball;

		// // Update position based on velocity and time delta
		// position.x += vx * 20//time * 60; // Scale velocity for frame independence
		// position.y += vy * 20//time * 60;
		//
		// // Boundary collision detection based on time and frame rate
		// if (position.x - size / 2 < 0 || position.x + size / 2 > width) {
		// 	ball.vx *= -1;
		// 	position.x = constrain(position.x, size / 2, width - size / 2);
		// }
		// if (position.y - size / 2 < 0 || position.y + size / 2 > height) {
		// 	ball.vy *= -1;
		// 	position.y = constrain(position.y, size / 2, height - size / 2);
		// }
		// // Apply friction for smoother motion
		// ball.vx *= friction;
		// ball.vy *= friction;

		const m = 100;

		const w = width/2;
		const h = height/2;

		const vw = mappers.fn(animation.circularProgression, 0, 1, m*2, w, easing.easeInOutBack);
		const vh = mappers.fn(animation.circularProgression, 0, 1, 2*3, h, easing.easeInOutBack);

		position.x = mappers.fn(sin(animation.angle+index+vx), -1, 1, -vw+m, vw-m)
		position.y = mappers.fn(cos(animation.angle-index+vy), -1, 1, -vh+m, vh-m)

		position.x += w;
		position.y += h;

		// position.x = constrain(position.x, m+size/2, width-m-size/2);
		// position.y = constrain(position.y, m+size/2, height-m-size/2);

		stroke(0, 0, 0, 230);
		// strokeWeight(.5);

		imageObjects.forEach( ({ img, ball }, _index) => {
			if (index == _index) {
				return;
			}

			if (links.includes(`${_index}-${index}`)) {
				return;
			}

			const { position: _position } = ball;
			const { x: _x, y: _y } = _position;

			const d = map(position.dist(_position), 0, 1000, 0, 1);

			stroke(0, 0, 0, d*100);

			line(position.x, position.y, _x, _y);
			links.push(`${index}-${_index}`);
		})
	});

	imageObjects.forEach( ({ img, ball }) => {
		const { size, position: { x, y }, vx, vy } = ball;

		drawImageWithMask({
			img,
			maskDrawer: graphics => {
				graphics.fill(255);
				graphics.noStroke();
				graphics.circle(x, y, size)
			}
		})
	})

	const defaultTitle = "photo-balloons".toUpperCase().replaceAll('-', "\n")

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
