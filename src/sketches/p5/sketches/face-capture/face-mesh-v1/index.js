import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import {
  getPointerGroups,
  getInteractionMetrics,
  initInteraction
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";

// face-mesh — a showcase of the `faceMesh` interaction handler (MediaPipe
// FaceLandmarker). The webcam is run through the 468-point face mesh; each
// landmark is drawn as an additively-blended dot so the whole face reads as a
// glowing point cloud. The expression blendshapes the same tracker produces
// (mouth open, smile, blink, brow raise) are surfaced as `face.*` metrics and
// used here to modulate the dots — open your mouth and the cloud swells, smile
// and it warms. Every value is also bindable to any sketch parameter.

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const interaction = o.interaction ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    8,
    10,
    18
  ] ) );

  // Expression scores (0..1) from the faceMesh blendshapes.
  const face = getInteractionMetrics( interaction ).face ?? {};
  const mouthOpen = face.mouthOpen ?? 0;
  const smile = face.smile ?? 0;

  // Mouth open swells the dots; smile warms the hue.
  const baseSize = o.pointSize ?? 4;
  const dotSize = baseSize * p.lerp(
    1,
    2.4,
    mouthOpen
  );
  const hueOffset = ( o.hueOffset ?? 0 ) + smile * 2.2;
  const meshGroups = getPointerGroups( interaction )
    .filter( ( group ) => group.source === "faceMesh" );

  p.push();
  p.noStroke();
  p.blendMode( p.ADD );

  meshGroups.forEach( ( group ) => {
    group.points.forEach( (
      v, index
    ) => {
      p.fill( colors.rainbow( {
        hueOffset,
        hueIndex: mappers.fn(
          index,
          0,
          group.points.length,
          -p.PI,
          p.PI
        ),
        opacityFactor: 0.75
      } ) );
      p.circle(
        v.x,
        v.y,
        dotSize
      );
    } );
  } );

  p.pop();

  // Camera preview + legend + any enabled debug layers (respects the form).
  drawInteractionOverlay( interaction );
} );
