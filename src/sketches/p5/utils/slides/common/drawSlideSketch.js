import sketch, {
  getP5
} from "../../sketch.js";
import {
  renderNestedSketchLayer
} from "../../nestedSketch.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

// Layer shapes offered beside "follow the host canvas" (SketchLayerAspectRatio
// in sketch.types.ts). Width / height, so the height falls out of the width.
const ASPECT_RATIOS = {
  "1:1": 1,
  "4:5": 4 / 5,
  "3:4": 3 / 4,
  "2:3": 2 / 3,
  "9:16": 9 / 16,
  "3:2": 3 / 2,
  "4:3": 4 / 3,
  "16:9": 16 / 9
};

/**
 * The rectangle a "sketch" layer occupies on the host canvas, in canvas pixels.
 *
 * `scale` is the layer's width as a fraction of the host's, and the aspect
 * ratio decides the height — "canvas" scales both axes together, so a layer
 * left at its defaults covers the page exactly and the sketch inside it is
 * framed the way it is on its own page.
 */
function layerBox(
  p, item
) {
  const width = p.width * ( item.scale ?? 1 );
  const ratio = ASPECT_RATIOS[ item.aspectRatio ];
  const height = ratio ? width / ratio : p.height * ( item.scale ?? 1 );

  return {
    width,
    height
  };
}

/**
 * Composite one embedded sketch.
 *
 * The layer's own sketch runs into a private graphics buffer
 * (see @/p5/utils/nestedSketch.js) sized by `resolution`: the buffer is where
 * "render at half resolution for performance" lives, and the box below is where
 * it lands on the page. Keeping the two apart is what lets a heavy sketch be
 * cheap without also being small.
 */
export default function drawSlideSketch(
  item, _slideOptions, key
) {
  const p = getP5();

  if ( !p || !item?.sketch || item.enabled === false ) {
    return;
  }

  const {
    width, height
  } = layerBox(
    p,
    item
  );

  if ( !( width > 0 ) || !( height > 0 ) ) {
    return;
  }

  const resolution = item.resolution ?? 1;
  const buffer = renderNestedSketchLayer(
    key,
    item,
    Math.max(
      1,
      Math.round( width * resolution )
    ),
    Math.max(
      1,
      Math.round( height * resolution )
    )
  );

  if ( !buffer ) {
    return;
  }

  const x = p.width * ( item.position?.x ?? 0.5 );
  const y = p.height * ( item.position?.y ?? 0.5 );

  p.push();

  if ( sketch.sketchOptions?.type === "webgl" ) {
    // A layer is a flat overlay, and on a WEBGL host it is one textured quad —
    // so it inherits whatever transform the host's draw left standing. A 3D
    // sketch that rotates the world and does not pop (common: the rotation IS
    // the composition) would sweep the layer into its scene, foreshortened and
    // half off-frame. Resetting restores the default camera view, where z = 0
    // maps 1:1 to canvas pixels, and the translate below is then the same
    // origin correction the other content renderers apply — a WEBGL canvas puts
    // (0, 0) at its centre, while content items position from the top-left.
    // (A host that moves the camera itself still carries the layer with it;
    // resetMatrix restores the view matrix, not the camera.)
    p.resetMatrix();
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  if ( item.blend ) {
    p.blendMode( item.blend );
  }

  const opacity = item.opacity ?? 1;

  if ( opacity < 1 ) {
    p.tint(
      255,
      Math.round( opacity * 255 )
    );
  }

  p.translate(
    x,
    y
  );
  p.rotate( item.rotation ?? 0 );
  p.imageMode( p.CENTER );
  p.image(
    buffer,
    0,
    0,
    width,
    height
  );

  p.pop();
  // push/pop does not restore the blend mode in p5, and a layer left on
  // "multiply" would tint every item drawn after it.
  p.blendMode( p.BLEND );

  // The drawn rectangle, for the on-canvas drag's hit-test. Rotation is not
  // folded in: the registry stores axis-aligned rects, and a rotated layer is
  // still grabbed by the box it spans.
  reportItemBounds(
    x - width / 2,
    y - height / 2,
    width,
    height
  );
}
