import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const sketchState = {
  buffers: {}
};

sketch.setup( () => {
  sketchState.buffers = {};
} );

const cachedGraphics = (
  key, cacheKey, render
) => {
  const p = getP5();
  const existing = sketchState.buffers[ key ];

  if ( !existing ) {
    sketchState.buffers[ key ] = {
      buffer: p.createGraphics(
        p.width,
        p.height
      ),
      cacheKey: null
    };
  }

  const entry = sketchState.buffers[ key ];

  if ( entry.cacheKey !== cacheKey ) {
    entry.cacheKey = cacheKey;
    entry.buffer.clear();
    entry.buffer.resizeCanvas(
      p.width,
      p.height
    );
    render( entry.buffer );
  }

  p.image(
    entry.buffer,
    0,
    0
  );
};

sketch.draw( async() => {
  const p = getP5();
  const t = animation.angle;

  const palettes = options.sketch.colors?.palettes ?? [
    {
      primary: [
        255,
        0,
        64
      ],
      secondary: [
        0,
        255,
        192
      ]
    },
    {
      primary: [
        0,
        255,
        192
      ],
      secondary: [
        255,
        0,
        64
      ]
    }
  ];
  const paletteSpeed = options.sketch.colors?.paletteSpeed ?? 0.5;
  const palette = mappers.circularIndex(
    t * paletteSpeed,
    palettes
  );
  const intermediary = options.sketch.colors?.intermediary ?? [
    255,
    255,
    255
  ];

  p.clear();
  p.background( ...palette.secondary );

  const columns = options.sketch.grid?.columns ?? 40;
  const proportional = options.sketch.grid?.proportional ?? true;
  const rows = proportional
    ? Math.round( ( columns * p.height ) / p.width )
    : options.sketch.grid?.rows ?? columns;

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

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const scale = cellWidth;

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detailLod ?? 6,
    options.sketch.noise?.detailFalloff ?? 0.6
  );

  const gridLineWeight = options.sketch.gridLines?.weight ?? 1;
  const commonCacheKey = `${ columns }-${ rows }-${ intermediary.join( "," ) }-${ gridLineWeight }-${ p.width }-${ p.height }`;

  cachedGraphics(
    "vl",
    commonCacheKey,
    ( buffer ) => {
      buffer.stroke( ...intermediary );
      buffer.strokeWeight( gridLineWeight );
      for ( let xi = 1; xi < columns; xi++ ) {
        const xPos = xi * cellWidth;

        buffer.line(
          xPos,
          0,
          xPos,
          p.height
        );
      }
    }
  );

  cachedGraphics(
    "hl",
    commonCacheKey,
    ( buffer ) => {
      buffer.stroke( ...intermediary );
      buffer.strokeWeight( gridLineWeight );
      for ( let yi = 1; yi < rows; yi++ ) {
        const yPos = yi * cellHeight;

        buffer.line(
          0,
          yPos,
          p.width,
          yPos
        );
      }
    }
  );

  const crossSizeMultiplier = options.sketch.cross?.sizeMultiplier ?? 0.5;
  const crossStrokeWeight = options.sketch.cross?.strokeWeight ?? 2;
  const noiseThreshold = options.sketch.noise?.threshold ?? 0.5;
  const noiseSpeed = options.sketch.noise?.speed ?? 0.05;

  p.stroke( ...palette.primary );
  p.strokeWeight( crossStrokeWeight );

  await grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      if ( x < 1 || x > columns - 1 ) {
        return;
      }
      if ( y < 1 || y > rows - 1 ) {
        return;
      }

      const cellCenter = p.createVector(
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );
      const n = p.noise(
        cellCenter.x + p.cos( t ) * noiseSpeed,
        cellCenter.y + p.sin( t ) * noiseSpeed,
        t * noiseSpeed
      );

      if ( n > noiseThreshold ) {
        return;
      }

      const size = scale * crossSizeMultiplier;

      p.line(
        cellCenter.x,
        cellCenter.y - size / 2,
        cellCenter.x,
        cellCenter.y + size / 2
      );
      p.line(
        cellCenter.x - size / 2,
        cellCenter.y,
        cellCenter.x + size / 2,
        cellCenter.y
      );
    }
  );

  renderTitle();
} );
