import { sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils } from '/assets/scripts/p5-sketches/utils/index.js';

const canvases = {};

sketch.setup(
	() => {
		canvases.background = createGraphics(
			sketch?.engine?.canvas?.width,
			sketch?.engine?.canvas?.height,
		);

		canvases.background.pixelDensity(options.backgroundPixelDensity || 0.05);

		background(...options.colors.background);
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
	cache.store("images", () => options.assets.map( imagePath => ({
		path: imagePath,
		exif: undefined,
		img: loadImage( imagePath ),
		filename: imagePath.split("/").pop(),
	}) ) );

	cache.get("images").forEach( async( imageObject ) => {
		const { path } = imageObject;

		imageObject.exif = await exif.load("http://localhost:3000/" + path);

		console.log(imageObject.exif)
	} );
});

sketch.draw( ( time, center, favoriteColor ) => {
	background(...options.colors.background);
	canvases.background.background(...options.colors.background);

	const images = cache.get("images");
	const imageObjectAtIndex = mappers.circularIndex(
		animation.progression*images.length,
		images
	);

	const imageAtIndex = imageObjectAtIndex.img

	imageUtils.marginImage({
		img: imageAtIndex,
		position: createVector(width/2, height/2),
		graphics: canvases.background,
		// margin: undefined,
		center: true,
		fill: true,
		scale: 1
	});

	// canvases.background.background(...options.colors.background, 0);
	// canvases.background.background(0, 0 ,0, 90);
	image(canvases.background, 0, 0, width, height);
	filter(BLUR, options.blur || 9, true);
	// filter(POSTERIZE, options.blur || 9, true);

	// background(...options.colors.background);

	imageUtils.marginImage({
		img: imageAtIndex,
		// graphics: canvases.background,
		margin: width*.05,
		center: true,
		position: createVector(width/2, height/2),
		// scale: .5,
		callback: (x, y, w, h) => {
			const fontSize = 20;
			const yTopPosition = y-fontSize/2;
			const yBottomPosition = y+h+fontSize/2;
			const textStyle = {
				size: fontSize,
				stroke: color(0, 0, 0, 255),
				fill: color(...options.colors.background),
				// fill: color(0, 0, 0, 255),
				// stroke: color(...options.colors.background),
				font: string.fonts.martian,
				// blendMode: EXCLUSION
			}

			string.write(
				exif.formatFocalLength(imageObjectAtIndex?.exif?.focalLength),
				x,
				yTopPosition,
				textStyle
			)

			string.write(
				exif.formatISO(imageObjectAtIndex?.exif?.iso),
				x+w,
				yTopPosition,
				{
					...textStyle,
					textAlign: [RIGHT]
				}
			)

			string.write(
				exif.formatAperture(imageObjectAtIndex?.exif?.aperture),
				map(1/4, 0, 1, x, x+w),
				yTopPosition,
				{
					...textStyle,
					textAlign: [LEFT]
				}
			)

			string.write(
				exif.formatShutterSpeed(imageObjectAtIndex?.exif?.shutterSpeed),
				map(2/4, 0, 1, x, x+w),
				yTopPosition,
				{
					...textStyle,
					textAlign: [LEFT]
				}
			)

			string.write(
				exif.formatLensModel(imageObjectAtIndex?.exif?.lens),
				x+w/2,
				yBottomPosition,
				{
					...textStyle,
					textAlign: [CENTER, TOP]
				}
			)
		}
	});

	const defaultTitle = "photo-switch-mosaic-background".replaceAll('-', "\n")

	if (animation.progression < 0.2) {
		string.write(
			options.texts.title || defaultTitle,
			width/2,
			height/2,
			{
				size: 172,
				stroke: color(...options.colors.text),
				fill: color(...options.colors.background),
				font: string.fonts.martian,
				textAlign: [CENTER, CENTER],
				blendMode: EXCLUSION
			}
		)
	}

	push();
	translate(width/2, 48);
	// rotate(PI/2)
	string.write(
		String(Number(animation.progression).toPrecision(3)).slice(0, 5),
		0, 0,
		{
			size: 24,
			stroke: color(...options.colors.text),
			fill: color(...options.colors.background),
			font: string.fonts.martian,
			textAlign: [CENTER],
		}
	)
	pop();

	if ( document.querySelector("canvas#defaultCanvas0.loaded") === null && images.every(image => image.exif !== undefined)) {
		document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
	}
});
