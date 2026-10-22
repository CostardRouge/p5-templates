/**
 * Canvas 2D painter for the display list vector3dViews.js builds — the
 * inspector's counterpart of the p5 widget's loop, so a tile draws exactly
 * what the canvas element draws.
 */

export type Vector3dOp =
  | { op: "line";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    a: number;
    weight?: number;
    dash?: boolean }
  | { op: "rect";
    x: number;
    y: number;
    w: number;
    h: number;
    a: number;
    fill?: boolean }
  | { op: "disc";
    x: number;
    y: number;
    r: number;
    a: number }
  | { op: "ring";
    x: number;
    y: number;
    r: number;
    a: number }
  | { op: "ellipse";
    x: number;
    y: number;
    rx: number;
    ry: number;
    a: number }
  | { op: "tri";
    points: number[];
    a: number }
  | { op: "text";
    text: string;
    x: number;
    y: number;
    size: number;
    a: number };

export function drawVector3dOps(
  ctx: CanvasRenderingContext2D,
  ops: Vector3dOp[],
  origin: { x: number;
    y: number },
  rgb: [number, number, number],
  size: number
): void {
  const color = ( alpha: number ) => `rgba(${ rgb[ 0 ] }, ${ rgb[ 1 ] }, ${ rgb[ 2 ] }, ${ alpha / 255 })`;

  ctx.save();
  ctx.translate(
    origin.x,
    origin.y
  );
  ctx.lineWidth = 1;

  for ( const op of ops ) {
    switch ( op.op ) {
      case "line":
        if ( op.a <= 0 ) {
          break;
        }

        ctx.strokeStyle = color( op.a );
        ctx.lineWidth = op.weight ?? 1;
        ctx.setLineDash( op.dash ? [
          size * 0.25,
          size * 0.2
        ] : [] );
        ctx.beginPath();
        ctx.moveTo(
          op.x1,
          op.y1
        );
        ctx.lineTo(
          op.x2,
          op.y2
        );
        ctx.stroke();
        ctx.setLineDash( [] );
        ctx.lineWidth = 1;
        break;
      case "rect":
        if ( op.fill ) {
          ctx.fillStyle = color( op.a );
          ctx.fillRect(
            op.x,
            op.y,
            op.w,
            op.h
          );
        } else {
          ctx.strokeStyle = color( op.a );
          ctx.strokeRect(
            op.x,
            op.y,
            op.w,
            op.h
          );
        }

        break;
      case "disc":
      case "ring":
        ctx.beginPath();
        ctx.arc(
          op.x,
          op.y,
          Math.max(
            0,
            op.r
          ),
          0,
          Math.PI * 2
        );

        if ( op.op === "disc" ) {
          ctx.fillStyle = color( op.a );
          ctx.fill();
        } else {
          ctx.strokeStyle = color( op.a );
          ctx.stroke();
        }

        break;
      case "ellipse":
        ctx.fillStyle = color( op.a );
        ctx.beginPath();
        ctx.ellipse(
          op.x,
          op.y,
          Math.max(
            0,
            op.rx
          ),
          Math.max(
            0,
            op.ry
          ),
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        break;
      case "tri":
        ctx.fillStyle = color( op.a );
        ctx.beginPath();
        ctx.moveTo(
          op.points[ 0 ],
          op.points[ 1 ]
        );
        ctx.lineTo(
          op.points[ 2 ],
          op.points[ 3 ]
        );
        ctx.lineTo(
          op.points[ 4 ],
          op.points[ 5 ]
        );
        ctx.closePath();
        ctx.fill();
        break;
      case "text":
        ctx.fillStyle = color( op.a );
        ctx.font = `${ op.size }px "Space Mono", ui-monospace, monospace`;
        ctx.textBaseline = "top";
        ctx.fillText(
          op.text,
          op.x,
          op.y
        );
        break;
      default:
        break;
    }
  }

  ctx.restore();
}
