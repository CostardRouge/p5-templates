import { captureOptions as options, shapes } from './index.js';

const imageUtils = {
	marginImage: ({
		              img,
		              graphics = window,
		              boundary = graphics,
		              margin = 0,
		              scale = 1,
		              callback,
		              center = false,
		              clip = false,
		              fill = false,
		              position = createVector(),
	              }) => {

		const scaledBoundary = createVector(
			boundary.width*scale,
			boundary.height*scale
		)

		const availableWidth = fill ? boundary.width - margin : scaledBoundary.x - 2 * margin;
		const availableHeight = fill ? boundary.height - margin : scaledBoundary.y - 2 * margin;
		const screenHeightScale = (availableHeight / img.height)
		const screenWidthScale = (availableWidth / img.width)
		const screenScale = fill ? Math.max(screenWidthScale, screenHeightScale) : Math.min(screenWidthScale, screenHeightScale);

		const h = img.height * screenScale * scale;
		const w = img.width * screenScale * scale;

		graphics.push();

		if (clip) {
			graphics.clip(() => {
				graphics.rect(
					position.x-scaledBoundary.x/2,
					position.y-scaledBoundary.y/2,
					scaledBoundary.x,
					scaledBoundary.y
				);
			}, { invert: false })
		}

		// graphics.noFill();
		// graphics.stroke("red");
		// graphics.strokeWeight(5);
		//
		// graphics.circle(
		// 	position.x,
		// 	position.y,
		// 	10
		// );
		//
		// graphics.rect(
		// 	position.x-scaledBoundary.x/2,
		// 	position.y-scaledBoundary.y/2,
		// 	scaledBoundary.x,
		// 	scaledBoundary.y
		// );

		if (center) {
			position.x -= w / 2;
			position.y -= h / 2;
		}

		graphics.image(
			img,
			position.x,
			position.y,
			w,
			h
		);

		graphics.pop();

		callback?.(position.x, position.y, w, h);

		if (options.lines) {
			stroke(options?.colors?.accent || color(128, 128, 255))

			shapes.hl(position.y);
			shapes.hl(position.y+h);

			shapes.vl(position.x);
			shapes.vl(position.x+w);
		}
	},
	clearColor: (img, clr = color(255, 255, 255)) => {
		img.loadPixels();

		const { levels: [ _r, _g, _b ] } = clr;

		for (let i = 0; i < img.pixels.length; i += 4) {
			let r = img.pixels[i];
			let g = img.pixels[i + 1];
			let b = img.pixels[i + 2];

			if (r === _r && g === _g && b === _b) {
				img.pixels[i + 3] = 0;
			}
		}

		img.updatePixels();
	}
};

export default imageUtils;
