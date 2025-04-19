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
			stroke(options?.colors?.accent)

			shapes.hl(y);
			shapes.hl(y+h);

			shapes.vl(x);
			shapes.vl(x+w);
		}
	}
};

export default imageUtils;
