import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
import cache from "@/p5/utils/cache.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const rotatePoint = (
  v, center, angle
) => {
  const cosine = Math.cos( angle );
  const sine = Math.sin( angle );

  return [
    ( cosine * ( v.x - center.x ) ) + ( sine * ( v.y - center.y ) ) + center.x,
    ( cosine * ( v.y - center.y ) ) - ( sine * ( v.x - center.x ) ) + center.y
  ];
};

sketch.setup( () => {} );

sketch.draw( async(
  _time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 40;
  const columns = options.sketch.grid?.columns ?? 40;

  const gridOptions = {
    topLeft: p.createVector(
      0,
      0
    ),
    topRight: p.createVector(
      p.width,
      0
    ),
    bottomLeft: p.createVector(
      0,
      p.height
    ),
    bottomRight: p.createVector(
      p.width,
      p.height
    ),
    rows,
    columns
  };

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.3
  );

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const rotationAngleMax = options.sketch.rotation?.angleMax ?? p.PI / 2;
  const rotationSpeed = options.sketch.rotation?.speed ?? 1;
  const sceneAngle = p.map(
    p.sin( t * rotationSpeed ),
    -1,
    1,
    -rotationAngleMax,
    rotationAngleMax
  );

  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;
  const strokeWeight = options.sketch.stroke?.weight ?? 10;
  const precisionDigits = options.sketch.colors?.precisionDigits ?? 3;

  p.noStroke();

  await grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      const cellCenter = p.createVector(
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );

      const [
        rotatedX,
        rotatedY
      ] = rotatePoint(
        cellCenter,
        center,
        sceneAngle
      );

      const noiseValue = cache.store(
        `noise-grid-v11-${ x }-${ y }-${ sceneAngle.toFixed( 4 ) }`,
        () => p.noise(
          rotatedX / columns,
          rotatedY / rows
        )
      );
      const angle = noiseValue * p.TAU * angleCycles;

      const cachedColor = cache.store(
        `noise-grid-v11-color-${ angle.toPrecision( precisionDigits ) }-${ hueOffset }`,
        () => colors.rainbow( {
          hueOffset,
          hueIndex: p.map(
            angle,
            0,
            p.TAU,
            -hueRange,
            hueRange
          ),
          opacityFactor
        } )
      );

      p.stroke( cachedColor );

      p.push();
      p.translate(
        cellCenter.x,
        cellCenter.y
      );
      p.strokeWeight( strokeWeight );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
