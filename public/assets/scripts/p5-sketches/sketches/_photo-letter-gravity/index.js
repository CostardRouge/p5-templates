import { sketch, animation, easing, scripts, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils } from '/assets/scripts/p5-sketches/utils/index.js';

await scripts.load("/assets/libraries/decomp.min.js");
await scripts.load("/assets/libraries/matter.min.js");

const { Engine, Body, Bodies, Vector, Composite, Common } = Matter;

Common.setDecomp(window.decomp)

const shape = [];

events.register("engine-mouse-dragged", () => {
	shape.push(createVector(mouseX, mouseY))
});

events.register("engine-mouse-released", () => {
	const bodyObject = {
		body: Bodies.fromVertices(
			mouseX,
			mouseY,
			shape,
			{
				friction: .3,
				frictionAir: .0001,
				restitution: .9,
			},
			false,
			.01,
			10,
			0.1
		),
		position: createVector(mouseX, mouseY),
		points: [
			...shape
		]
	}

	if (!bodyObject.body) {
		shape.length = 0;
		console.log("early return")
		return;
	}

	Composite.add(matter.engine.world, bodyObject.body);
	matter.bodies.push(bodyObject);

	shape.length = 0;
});

const canvases = {
	mask: undefined,
	imageBuffer: undefined,
}

const matter = {
	engine: Engine.create(),
	bottom: undefined,
	bodies: [],
	boundaries: []
}

function drawImageWithMask({
	img,
	maskDrawer,
	graphics = window
}) {
	// image(img, 0, 0, graphics.width, graphics.height);

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

	maskDrawer?.(canvases.mask);

	const maskedImage = canvases.imageBuffer.get();

	maskedImage.mask(canvases.mask);

	graphics.image(maskedImage, 0, 0, graphics.width, graphics.height);
}

function addLetter(x, y, text, size = 72) {
	const bodyObject = {
		text,
		size,
		points: undefined,
		position: createVector(x, y),
		body: undefined//Bodies.circle(x, y, size, size)
	}

	matter.bodies.unshift(bodyObject)
	// Composite.add(matter.engine.world, bodyObject.body)
}

function addBoundary(x, y, w, h) {
	const newBoundary = Bodies.rectangle(x, y, w, h, {
		isStatic: true,
	});

	matter.boundaries.unshift(newBoundary);
	Composite.add(matter.engine.world, newBoundary);
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

		// canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.5);
		background(...options.colors.background);

		const margin = 50;
		const thickness = 50;

		addBoundary(width/2, height+thickness/2-margin, width, thickness);
		addBoundary(width/2, -thickness/2+margin, width, thickness);
		addBoundary(-thickness/2+margin, height/2, thickness, height);
		addBoundary(width+thickness/2-margin, height/2, thickness, height);

		// "gravity".split("").forEach( letter => {
		// 	addLetter(
		// 		width/2,
		// 		height/2,
		// 		// random(width),
		// 		// random(height),
		// 		letter,
		// 		288
		// 	)
		// })

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

sketch.draw( ( time, center, favoriteColor ) => {
	background(...options.colors.background);

	Engine.update(matter.engine);

	if (string.fonts.agiro.font) {
		const emptyLetterPoints = matter.bodies.filter( ({ points }) => points === undefined );

		emptyLetterPoints.forEach( bodyObject => {
			const { text, position, size } = bodyObject;

			bodyObject.points = string.getTextPoints({
				text,
				size,
				position,
				// sampleFactor: .1,
				font: string.fonts.agiro
			})

			bodyObject.body = Bodies.fromVertices(
				position.x,
				position.y,
				// bodyObject.points,
				// {
				// 	// friction: 0.5,
				// 	// restitution: 0.8,
				// 	// angle: PI
				// }
				// bodyObject.points.map(({x, y})=> Vector.create(x, y))
				bodyObject.points.map(({x, y}) => Vector.create(position.x-x, position.y-y) )
			);

			if (!bodyObject.body) {
				return;
			}

			Composite.add(matter.engine.world, bodyObject.body)
		});
	}

	matter.engine.gravity = Vector.create(
		mappers.fn(sin(animation.angle*2), -1, 1, -1, 1, easing.easeInOutExpo),
		mappers.fn(cos(animation.angle*2), -1, 1, -1, 1, easing.easeInOutExpo),
	)

	push()
	stroke("blue")
	strokeWeight(1)
	point(mouseX, mouseY);
	beginShape()
	for (let i = 0; i < shape?.length; i++) {
		vertex(shape[i].x, shape[i].y);
	}
	endShape()
	pop()

	matter.bodies.forEach( ({ body, points, position: { x, y }, size }, index) => {
		if (!body) {
			strokeWeight(50)
			point(x, y);
			return
		}

		const { position: { x: mX, y: mY }, vertices, angle } = body;

		push()
		stroke("blue")

		// translate(mX, mY);
		// rotate(angle)
		beginShape()
		for (let i = 0; i < vertices?.length; i++) {
			vertex(vertices[i].x, vertices[i].y);
		}
		endShape(CLOSE)

		strokeWeight(50)
		point(mX, mY);

		pop()



		// drawImageWithMask({
		// 	img: cache.get("images")[0].img,
		// 	maskDrawer: graphics => {
		// 		graphics.fill(255);
		// 		graphics.noStroke();
		// 		graphics.ellipse(x, y, size*2, size*2)
		// 	}
		// })
	})

	const defaultTitle = "photo-text-gravity".toUpperCase().replaceAll('-', "\n")

	// if (animation.progression < 0.2) {
	// 	string.write(
	// 		defaultTitle,
	// 		// options.texts.title || defaultTitle,
	// 		width/2,
	// 		height/2,
	// 		{
	// 			size: 172,
	// 			stroke: color(...options.colors.text),
	// 			fill: color(...options.colors.background),
	// 			font: string.fonts.martian,
	// 			textAlign: [CENTER, CENTER],
	// 			blendMode: EXCLUSION
	// 		}
	// 	)
	// }

	if ( document.querySelector("canvas#defaultCanvas0.loaded") === null) {
		document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
	}
});
