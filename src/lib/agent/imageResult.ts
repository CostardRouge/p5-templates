import type {
  ImageResult
} from "../../../scripts/mcp/registry.ts";

/**
 * A picture for the agent: `blob` decoded, scaled so its longest edge is at
 * most `maxEdge`, re-encoded. JPEG has no alpha, so a transparent sketch is
 * flattened on white — as a viewer would show it.
 */
export async function blobToImageResult(
  blob: Blob, maxEdge: number, format: "png" | "jpeg", note: string
): Promise<ImageResult> {
  const bitmap = await createImageBitmap( blob );
  const scale = Math.min(
    1,
    maxEdge / Math.max(
      bitmap.width,
      bitmap.height
    )
  );
  const canvas = document.createElement( "canvas" );

  canvas.width = Math.max(
    1,
    Math.round( bitmap.width * scale )
  );
  canvas.height = Math.max(
    1,
    Math.round( bitmap.height * scale )
  );

  const ctx = canvas.getContext( "2d" ) as CanvasRenderingContext2D;
  const mimeType = format === "png" ? "image/png" : "image/jpeg";

  if ( mimeType === "image/jpeg" ) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }
  ctx.drawImage(
    bitmap,
    0,
    0,
    canvas.width,
    canvas.height
  );
  bitmap.close();

  return {
    kind: "image",
    mimeType,
    data: canvas.toDataURL(
      mimeType,
      0.9
    ).replace(
      /^data:[^,]+,/,
      ""
    ),
    width: canvas.width,
    height: canvas.height,
    note: `${ note } Canvas ${ Math.round( canvas.width / scale ) }×${ Math.round( canvas.height / scale ) }${ scale < 1 ? `, shown at ${ canvas.width }×${ canvas.height }` : "" }.`
  };
}

/** One cell of a contact sheet: a frame and what to print on it. */
export interface SheetFrame {
  blob: Blob;
  label: string;
}

/** Columns × rows for `count` cells, as square as it gets (the headless `render.stills` layout). */
export function sheetGrid( count: number ): { columns: number;
  rows: number } {
  const columns = Math.ceil( Math.sqrt( Math.max(
    1,
    count
  ) ) );

  return {
    columns,
    rows: Math.ceil( Math.max(
      1,
      count
    ) / columns )
  };
}

/**
 * Several frames tiled on ONE picture, left to right then down, each with its
 * label in a corner — the layout `render.stills` answers server-side, drawn in
 * the tab. The cells keep the first frame's size; the sheet is scaled so its
 * longest edge is at most `maxEdge`, and the labels are drawn AFTER scaling so
 * they stay legible at the size the agent sees. Gaps and a JPEG's flattened
 * alpha read against mid grey.
 */
export async function framesToContactSheet(
  frames: SheetFrame[], maxEdge: number, format: "png" | "jpeg", note: string
): Promise<ImageResult> {
  if ( !frames.length ) {
    throw new Error( "a contact sheet needs at least one frame" );
  }

  const bitmaps = await Promise.all( frames.map( ( frame ) => createImageBitmap( frame.blob ) ) );
  const cellWidth = bitmaps[ 0 ].width;
  const cellHeight = bitmaps[ 0 ].height;
  const {
    columns, rows
  } = sheetGrid( bitmaps.length );
  const gap = bitmaps.length > 1 ? Math.round( Math.max(
    cellWidth,
    cellHeight
  ) * 0.02 ) : 0;
  const fullWidth = columns * cellWidth + ( columns - 1 ) * gap;
  const fullHeight = rows * cellHeight + ( rows - 1 ) * gap;
  const scale = Math.min(
    1,
    maxEdge / Math.max(
      fullWidth,
      fullHeight
    )
  );
  const canvas = document.createElement( "canvas" );

  canvas.width = Math.max(
    1,
    Math.round( fullWidth * scale )
  );
  canvas.height = Math.max(
    1,
    Math.round( fullHeight * scale )
  );

  const ctx = canvas.getContext( "2d" ) as CanvasRenderingContext2D;
  const mimeType = format === "png" ? "image/png" : "image/jpeg";

  ctx.fillStyle = "#808080";
  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const shownCellWidth = Math.round( cellWidth * scale );
  const shownCellHeight = Math.round( cellHeight * scale );
  // Legible on a 1024 px sheet of six, unobtrusive on a single large frame.
  const fontSize = Math.max(
    10,
    Math.round( Math.min(
      shownCellWidth,
      shownCellHeight
    ) * 0.07 )
  );
  const pad = Math.round( fontSize * 0.4 );

  ctx.font = `${ fontSize }px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textBaseline = "top";

  bitmaps.forEach( (
    bitmap, i
  ) => {
    const x = Math.round( ( i % columns ) * ( cellWidth + gap ) * scale );
    const y = Math.round( Math.floor( i / columns ) * ( cellHeight + gap ) * scale );

    ctx.drawImage(
      bitmap,
      x,
      y,
      shownCellWidth,
      shownCellHeight
    );
    bitmap.close();

    const label = frames[ i ].label;

    if ( !label ) {
      return;
    }

    const textWidth = ctx.measureText( label ).width;

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(
      x,
      y,
      Math.round( textWidth + pad * 2 ),
      Math.round( fontSize + pad * 2 )
    );
    ctx.fillStyle = "#fff";
    ctx.fillText(
      label,
      x + pad,
      y + pad
    );
  } );

  return {
    kind: "image",
    mimeType,
    data: canvas.toDataURL(
      mimeType,
      0.9
    ).replace(
      /^data:[^,]+,/,
      ""
    ),
    width: canvas.width,
    height: canvas.height,
    note: `${ note } Canvas ${ cellWidth }×${ cellHeight }, ${ bitmaps.length } frame${ bitmaps.length > 1 ? "s" : "" } left to right then down${ scale < 1 ? `, each shown at ${ shownCellWidth }×${ shownCellHeight }` : "" }.`
  };
}
