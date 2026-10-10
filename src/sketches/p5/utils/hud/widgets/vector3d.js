import string from "../../string.js";
import animation from "../../animation.js";
import {
  pushHistory,
  series
} from "../history.js";
import {
  resolveMeta,
  resolveValue
} from "../sources.js";
import {
  getFont,
  paintWidgetBackground,
  reportWidgetBounds,
  resolveBlock,
  toColor,
  withHudTransform
} from "./common.js";
import {
  DEFAULT_YAW,
  buildVector3dView,
  toTriple
} from "../vector3dViews.js";

/** How many past frames the trail draws (~0.8 s at 60 fps). */
const TRAIL_FRAMES = 48;

const AXES = [
  "x",
  "y",
  "z"
];

/**
 * The trail: the last frames' values, fed through the sparkline's history so
 * it is keyed on frameCount (replays the same in a recording) and cleared
 * between sketches. One buffer per axis, keyed off the source.
 */
function trailFor(
  source, value
) {
  for ( const axis of AXES ) {
    pushHistory(
      `${ source }#${ axis }`,
      value[ axis ]
    );
  }

  const [
    xs,
    ys,
    zs
  ] = AXES.map( ( axis ) => series( `${ source }#${ axis }` ) );
  const length = Math.min(
    xs.length,
    ys.length,
    zs.length,
    TRAIL_FRAMES
  );
  const out = [];

  for ( let i = length; i > 0; i-- ) {
    out.push( {
      x: xs[ xs.length - i ],
      y: ys[ ys.length - i ],
      z: zs[ zs.length - i ]
    } );
  }

  return out;
}

/**
 * Vector 3D widget: a `{ x, y, z }` parameter drawn in one of five views —
 * the control's box, three orthographic maps, a map with a depth gauge, three
 * axis bars, or a gizmo. The geometry lives in vector3dViews.js (shared with
 * the inspector's live tiles); this file only places the block and paints the
 * display list with the element's fill, font and blend.
 */
export default function vector3d(
  cfg, style
) {
  withHudTransform( ( p ) => {
    const value = toTriple( resolveValue( cfg.source ) );

    if ( !value ) {
      return;
    }

    const s = cfg.size ?? 16;
    const meta = resolveMeta( cfg.source );
    const label = String( cfg.label || meta.label || cfg.source || "" ).toUpperCase();
    const font = getFont( cfg.font ?? style.font );
    const fillValue = cfg.fill ?? style.fill;
    const blend = cfg.blend ?? style.blend;
    const trail = cfg.trail === false ? [] : trailFor(
      cfg.source,
      value
    );
    // Spin is whole turns per loop, read from the loop clock: a captured frame
    // shows the same angle as the preview did.
    const yaw = DEFAULT_YAW + ( cfg.spin ?? 0 ) * Math.PI * 2 * animation.progression;

    const measure = (
      text, size
    ) => {
      p.push();
      p.textFont( font );
      p.textSize( size );
      const width = p.textWidth( text );

      p.pop();

      return width;
    };

    const {
      w, h, ops
    } = buildVector3dView( {
      view: cfg.view,
      value,
      trail,
      cfg,
      size: s,
      yaw,
      label,
      measure
    } );

    const {
      blockX,
      blockY
    } = resolveBlock(
      p,
      cfg.anchor ?? "bottom-right",
      cfg.offset,
      w,
      h
    );

    reportWidgetBounds(
      blockX,
      blockY,
      w,
      h
    );

    paintWidgetBackground(
      style,
      blockX,
      blockY,
      w,
      h,
      s
    );

    // The fill's own alpha scales every op's alpha, so a translucent HUD
    // colour keeps its frame / guide / point proportions.
    const baseAlpha = ( Array.isArray( fillValue ) && fillValue.length > 3 ? fillValue[ 3 ] : 255 ) / 255;
    const colorAt = ( alpha ) => toColor(
      p,
      fillValue,
      undefined,
      alpha * baseAlpha
    );
    const context2d = p.drawingContext;
    const canDash = typeof context2d?.setLineDash === "function";

    p.push();

    if ( blend ) {
      p.blendMode( blend );
    }

    for ( const op of ops ) {
      switch ( op.op ) {
        case "line": {
          if ( op.a <= 0 ) {
            break;
          }

          p.noFill();
          p.stroke( colorAt( op.a ) );
          p.strokeWeight( op.weight ?? 1 );

          if ( op.dash && canDash ) {
            context2d.setLineDash( [
              s * 0.25,
              s * 0.2
            ] );
          }

          p.line(
            blockX + op.x1,
            blockY + op.y1,
            blockX + op.x2,
            blockY + op.y2
          );

          if ( op.dash && canDash ) {
            context2d.setLineDash( [] );
          }

          break;
        }
        case "rect":
          if ( op.fill ) {
            p.noStroke();
            p.fill( colorAt( op.a ) );
          } else {
            p.noFill();
            p.stroke( colorAt( op.a ) );
            p.strokeWeight( 1 );
          }

          p.rect(
            blockX + op.x,
            blockY + op.y,
            op.w,
            op.h
          );
          break;
        case "disc":
          p.noStroke();
          p.fill( colorAt( op.a ) );
          p.circle(
            blockX + op.x,
            blockY + op.y,
            op.r * 2
          );
          break;
        case "ring":
          p.noFill();
          p.stroke( colorAt( op.a ) );
          p.strokeWeight( 1 );
          p.circle(
            blockX + op.x,
            blockY + op.y,
            op.r * 2
          );
          break;
        case "ellipse":
          p.noStroke();
          p.fill( colorAt( op.a ) );
          p.ellipse(
            blockX + op.x,
            blockY + op.y,
            op.rx * 2,
            op.ry * 2
          );
          break;
        case "tri":
          p.noStroke();
          p.fill( colorAt( op.a ) );
          p.triangle(
            blockX + op.points[ 0 ],
            blockY + op.points[ 1 ],
            blockX + op.points[ 2 ],
            blockY + op.points[ 3 ],
            blockX + op.points[ 4 ],
            blockY + op.points[ 5 ]
          );
          break;
        default:
          break;
      }
    }

    p.pop();

    // Text last, through the shared writer so fonts and blend behave like
    // every other HUD element's.
    for ( const op of ops ) {
      if ( op.op !== "text" ) {
        continue;
      }

      string.write(
        op.text,
        blockX + op.x,
        blockY + op.y,
        {
          size: op.size,
          font,
          fill: colorAt( op.a ),
          stroke: false,
          strokeWeight: 0,
          blendMode: blend,
          textWidth: -1,
          textAlign: [
            p.LEFT,
            p.TOP
          ]
        }
      );
    }
  } );
}
