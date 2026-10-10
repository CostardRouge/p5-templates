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
