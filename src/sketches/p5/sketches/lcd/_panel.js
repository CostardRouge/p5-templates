/**
 * Draws a 1-bit framebuffer as a backlit monochrome LCD panel on a Canvas2D
 * context: bezel, backlight with its falloff, the faint grid of unlit cells,
 * the shadow each dark cell casts on the backlight behind it, the lit cells,
 * and a glare across the glass.
 *
 * It paints with the raw context (`p.drawingContext`) rather than p5 shapes:
 * a 128 × 64 panel is up to 8192 cells per layer, and one path of rects filled
 * once is what keeps that a few milliseconds instead of thousands of calls.
 */

function css(
  color, alpha = 1
) {
  const [
    r = 0,
    g = 0,
    b = 0
  ] = color ?? [];

  return `rgba(${ r }, ${ g }, ${ b }, ${ alpha })`;
}

function mix(
  a, b, amount
) {
  return [
    0,
    1,
    2
  ].map( ( channel ) => Math.round( ( a[ channel ] ?? 0 ) + ( ( b[ channel ] ?? 0 ) - ( a[ channel ] ?? 0 ) ) * amount ) );
}

/**
 * Where the panel sits on a canvas: the pitch of one cell and the rounded
 * edges of every column and row, so neighbouring cells share exact pixel
 * boundaries and the grid never shimmers at a fractional pitch.
 */
export function panelLayout( {
  canvasWidth, canvasHeight, columns, rows, fill = 0.88, padding = 6, gap = 0.12
} ) {
  const pitch = Math.min(
    ( fill * canvasWidth ) / ( columns + 2 * padding ),
    ( fill * canvasHeight ) / ( rows + 2 * padding )
  );
  const screenWidth = columns * pitch;
  const screenHeight = rows * pitch;
  const x = ( canvasWidth - screenWidth ) / 2;
  const y = ( canvasHeight - screenHeight ) / 2;
  const gapPx = Math.max(
    0,
    Math.min(
      0.9,
      gap
    )
  ) * pitch;
  const edges = (
    origin, count
  ) => {
    const starts = new Float32Array( count );
    const sizes = new Float32Array( count );

    for ( let index = 0; index < count; index++ ) {
      const start = Math.round( origin + index * pitch );
      const end = Math.round( origin + ( index + 1 ) * pitch - gapPx );

      starts[ index ] = start;
      sizes[ index ] = Math.max(
        1,
        end - start
      );
    }

    return {
      starts,
      sizes
    };
  };

  return {
    pitch,
    x,
    y,
    width: screenWidth,
    height: screenHeight,
    padding: padding * pitch,
    columns: edges(
      x,
      columns
    ),
    rows: edges(
      y,
      rows
    )
  };
}

function roundedRect(
  ctx, x, y, width, height, radius
) {
  const r = Math.max(
    0,
    Math.min(
      radius,
      width / 2,
      height / 2
    )
  );

  ctx.beginPath();
  ctx.moveTo(
    x + r,
    y
  );
  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r
  );
  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r
  );
  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    r
  );
  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    r
  );
  ctx.closePath();
}

/** One path holding a rect per cell whose bit equals `value`, offset by (dx, dy). */
function cellsPath(
  ctx, frame, layout, value, dx = 0, dy = 0
) {
  const {
    width, height, bits
  } = frame;
  const {
    columns, rows
  } = layout;

  ctx.beginPath();

  for ( let row = 0; row < height; row++ ) {
    const top = rows.starts[ row ] + dy;
    const cellHeight = rows.sizes[ row ];

    for ( let column = 0; column < width; column++ ) {
      if ( bits[ row * width + column ] !== value ) {
        continue;
      }

      ctx.rect(
        columns.starts[ column ] + dx,
        top,
        columns.sizes[ column ],
        cellHeight
      );
    }
  }
}

/**
 * Paints the panel. `ghostFrame`, when given, is an earlier frame drawn faintly
 * under the current one: an LCD's slow crystal response, the smear behind
 * anything that moves.
 */
export function drawPanel(
  ctx, frame, layout, style, ghostFrame = null
) {
  const {
    backlight = [
      255,
      130,
      0
    ],
    ink = [
      22,
      12,
      4
    ],
    bezel = null,
    unlit = 0.05,
    shadow = 0.35,
    shadowOpacity = 0.28,
    persistence = 0,
    vignette = 0.35,
    glare = 0.12
  } = style;
  const {
    x, y, width, height, pitch
  } = layout;

  ctx.save();

  if ( bezel ) {
    const pad = layout.padding;
    const radius = ( bezel.radius ?? 5 ) * pitch;

    ctx.fillStyle = css( bezel.color );
    roundedRect(
      ctx,
      x - pad,
      y - pad,
      width + 2 * pad,
      height + 2 * pad,
      radius
    );
    ctx.fill();

    // A darker lip around the glass, so the screen reads as set into the bezel.
    const lip = Math.max(
      1,
      pitch * 0.6
    );

    ctx.fillStyle = css( mix(
      bezel.color ?? [
        0,
        0,
        0
      ],
      [
        0,
        0,
        0
      ],
      0.55
    ) );
    roundedRect(
      ctx,
      x - lip,
      y - lip,
      width + 2 * lip,
      height + 2 * lip,
      lip
    );
    ctx.fill();
  }

  // Backlight, brighter in the middle and falling off towards the edges.
  const radius = Math.hypot(
    width,
    height
  ) / 2;
  const light = ctx.createRadialGradient(
    x + width / 2,
    y + height / 2,
    0,
    x + width / 2,
    y + height / 2,
    radius
  );

  light.addColorStop(
    0,
    css( mix(
      backlight,
      [
        255,
        255,
        255
      ],
      vignette * 0.25
    ) )
  );
  light.addColorStop(
    1,
    css( mix(
      backlight,
      [
        0,
        0,
        0
      ],
      vignette * 0.6
    ) )
  );
  ctx.fillStyle = light;
  ctx.fillRect(
    x,
    y,
    width,
    height
  );

  ctx.beginPath();
  ctx.rect(
    x,
    y,
    width,
    height
  );
  ctx.clip();

  if ( unlit > 0 ) {
    ctx.fillStyle = css(
      ink,
      unlit
    );
    cellsPath(
      ctx,
      frame,
      layout,
      0
    );
    ctx.fill();
  }

  if ( ghostFrame && persistence > 0 ) {
    ctx.fillStyle = css(
      ink,
      persistence
    );
    cellsPath(
      ctx,
      ghostFrame,
      layout,
      1
    );
    ctx.fill();
  }

  if ( shadow > 0 && shadowOpacity > 0 ) {
    ctx.fillStyle = css(
      ink,
      shadowOpacity
    );
    cellsPath(
      ctx,
      frame,
      layout,
      1,
      shadow * pitch,
      shadow * pitch
    );
    ctx.fill();
  }

  ctx.fillStyle = css( ink );
  cellsPath(
    ctx,
    frame,
    layout,
    1
  );
  ctx.fill();

  if ( glare > 0 ) {
    const sheen = ctx.createLinearGradient(
      x,
      y,
      x + width * 0.6,
      y + height
    );

    sheen.addColorStop(
      0,
      `rgba(255, 255, 255, ${ glare })`
    );
    sheen.addColorStop(
      0.45,
      `rgba(255, 255, 255, ${ glare * 0.25 })`
    );
    sheen.addColorStop(
      0.46,
      "rgba(255, 255, 255, 0)"
    );
    ctx.fillStyle = sheen;
    ctx.fillRect(
      x,
      y,
      width,
      height
    );
  }

  ctx.restore();
}
