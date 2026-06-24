import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";
import slides from "../index.js";

/**
 * Corner metadata overlay: up to four labels (one per corner) plus an optional
 * slide-progression indicator along the bottom (or top).
 *
 * Options (metaOption):
 *   - topLeft / topRight / bottomLeft / bottomRight: corner content. Either a
 *     plain string, or an object { text, fill, stroke, font, size, blend } to
 *     override the base style for that corner only.
 *   - size / strokeWeight: base text size (24) and stroke weight (2).
 *   - stroke / fill: [r,g,b(,a)] arrays. stroke omitted -> no stroke.
 *   - font: key into string.fonts (falls back to martian).
 *   - blend: blend mode for the text.
 *   - horizontalMargin / verticalMargin: corner inset as a fraction (0.05).
 *   - counter: { corner = "bottomRight", format = "{i} / {n}" } convenience that
 *     fills an empty corner with the slide counter.
 *   - Any corner string supports tokens: {i} (1-based index), {index} (0-based),
 *     {n} / {count} (total).
 *   - slideProgression: indicator config, or { hidden: true } to skip.
 *       style: "line" (default) | "dots" | "bar"
 *       stroke: [r,g,b] colour of the filled portion
 *       weight: line/bar thickness (2)
 *       track: true for a faint full-length backdrop, or [r,g,b(,a)] for a custom one
 *       position: "bottom" (default) | "top"
 *       padding: horizontal inset fraction (defaults to horizontalMargin)
 *       rounded: round line caps / bar corners / use dots
 *       dotSize: diameter for the "dots" style
 */
export default function drawSlideMeta( metaOption ) {
  const p = getP5();

  p.push();
  if ( sketch.sketchOptions?.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  const W = p.width;
  const H = p.height;
  const horizontalMargin = metaOption.horizontalMargin ?? 0.05;
  const verticalMargin = metaOption.verticalMargin ?? 0.05;

  // Replace counter tokens so any corner string can show the slide position.
  const interpolate = ( text ) => {
    if ( typeof text !== "string" ) {
      return text;
    }

    return text
      .replaceAll(
        "{i}",
        String( slides.index + 1 )
      )
      .replaceAll(
        "{index}",
        String( slides.index )
      )
      .replaceAll(
        "{n}",
        String( slides.count )
      )
      .replaceAll(
        "{count}",
        String( slides.count )
      );
  };

  const baseStyle = {
    size: metaOption.size ?? 24,
    strokeWeight: metaOption.strokeWeight ?? 2,
    stroke: metaOption.stroke ? p.color( ...metaOption.stroke ) : false,
    fill: metaOption.fill ? p.color( ...metaOption.fill ) : p.color( 0 ),
    font: string.fonts?.[ metaOption.font ] ?? string.fonts.martian,
    blendMode: metaOption.blend
  };

  // Merge a per-corner override object onto the base style.
  const styleFor = ( corner ) => {
    if ( !corner || typeof corner !== "object" ) {
      return baseStyle;
    }

    return {
      ...baseStyle,
      ...( corner.size !== undefined ? {
        size: corner.size
      } : {} ),
      ...( corner.strokeWeight !== undefined ? {
        strokeWeight: corner.strokeWeight
      } : {} ),
      ...( corner.fill ? {
        fill: p.color( ...corner.fill )
      } : {} ),
      ...( corner.stroke ? {
        stroke: p.color( ...corner.stroke )
      } : {} ),
      ...( corner.font ? {
        font: string.fonts?.[ corner.font ] ?? baseStyle.font
      } : {} ),
      ...( corner.blend ? {
        blendMode: corner.blend
      } : {} )
    };
  };

  const textOf = ( corner ) =>
    interpolate( corner && typeof corner === "object" ? corner.text : corner );

  const corners = {
    topLeft: metaOption.topLeft,
    topRight: metaOption.topRight,
    bottomLeft: metaOption.bottomLeft,
    bottomRight: metaOption.bottomRight
  };

  // Counter convenience: drop "{i} / {n}" into an otherwise-empty corner.
  if ( metaOption.counter ) {
    const corner = metaOption.counter.corner ?? "bottomRight";

    if ( !corners[ corner ] ) {
      corners[ corner ] = metaOption.counter.format ?? "{i} / {n}";
    }
  }

  // Right corners use a negative x with the default textWidth (= canvas width),
  // so RIGHT alignment anchors the text at width - width * horizontalMargin.
  string.write(
    textOf( corners.topLeft ),
    W * horizontalMargin,
    H * verticalMargin,
    {
      ...styleFor( corners.topLeft ),
      textAlign: [
        p.LEFT
      ]
    }
  );

  string.write(
    textOf( corners.topRight ),
    -W * horizontalMargin,
    H * verticalMargin,
    {
      ...styleFor( corners.topRight ),
      textAlign: [
        p.RIGHT
      ]
    }
  );

  string.write(
    textOf( corners.bottomLeft ),
    W * horizontalMargin,
    H * ( 1 - verticalMargin ),
    {
      ...styleFor( corners.bottomLeft ),
      textAlign: [
        p.LEFT
      ]
    }
  );

  string.write(
    textOf( corners.bottomRight ),
    -W * horizontalMargin,
    H * ( 1 - verticalMargin ),
    {
      ...styleFor( corners.bottomRight ),
      textAlign: [
        p.RIGHT
      ]
    }
  );

  const prog = metaOption.slideProgression;

  if ( !prog || prog.hidden === true || slides.count <= 0 ) {
    p.pop();

    return;
  }

  const t = p.constrain(
    ( slides.index + 1 ) / slides.count,
    0,
    1
  );
  const weight = prog.weight ?? 2;
  const pad = prog.padding ?? horizontalMargin;
  const x0 = W * pad;
  const x1 = W - W * pad;
  const y = prog.position === "top"
    ? H * verticalMargin - 14
    : H - H * pad + 14;

  const fg = prog.stroke ? p.color( ...prog.stroke ) : p.color( 0 );
  const faint = () => {
    const c = p.color( ...( prog.stroke ?? [
      0
    ] ) );

    c.setAlpha( 60 );

    return c;
  };
  const trackColor = prog.track === true
    ? faint()
    : Array.isArray( prog.track ) ? p.color( ...prog.track ) : null;

  p.push();
  p.blendMode( p.BLEND );
  p.strokeCap( prog.rounded ? p.ROUND : p.SQUARE );

  if ( prog.style === "dots" ) {
    p.noStroke();

    const n = slides.count;
    const diameter = prog.dotSize ?? weight * 2.2;

    for ( let i = 0; i < n; i++ ) {
      const dx = n > 1 ? p.lerp(
        x0,
        x1,
        i / ( n - 1 )
      ) : x0;

      p.fill( i <= slides.index ? fg : ( trackColor ?? faint() ) );
      p.circle(
        dx,
        y,
        diameter
      );
    }
  } else if ( prog.style === "bar" ) {
    const h = weight;
    const radius = prog.rounded ? h / 2 : 0;

    p.noStroke();

    if ( trackColor ) {
      p.fill( trackColor );
      p.rect(
        x0,
        y - h / 2,
        x1 - x0,
        h,
        radius
      );
    }

    const filled = ( x1 - x0 ) * t;

    if ( filled > 0 ) {
      p.fill( fg );
      p.rect(
        x0,
        y - h / 2,
        filled,
        h,
        radius
      );
    }
  } else {
    p.strokeWeight( weight );

    if ( trackColor ) {
      p.stroke( trackColor );
      p.line(
        x0,
        y,
        x1,
        y
      );
    }

    p.stroke( fg );
    p.line(
      x0,
      y,
      p.lerp(
        x0,
        x1,
        t
      ),
      y
    );
  }

  p.pop();
  p.pop();
}
