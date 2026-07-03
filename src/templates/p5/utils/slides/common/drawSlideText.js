import string from "../../string.js";
import {
  getP5
} from "../../sketch";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

const parseFloatDefault = (
  value, _default = 0.015
) => {
  const float = Number.parseFloat( value );

  if ( Number.isFinite( float ) ) {
    return float;
  }

  return _default;
};

export default function drawSlideText( textOption ) {
  const p = getP5();
  const horizontalMargin = parseFloatDefault( textOption.margin.horizontal );
  const verticalMargin = parseFloatDefault( textOption.margin.vertical );

  const x = p.width * horizontalMargin + p.width * textOption.position.x;
  const y = p.height * verticalMargin + p.height * textOption.position.y;
  const textWidth = p.width - 2 * ( p.width * horizontalMargin );
  const textHeight = p.height - 2 * ( p.height * verticalMargin );
  const size = Number( textOption.size );
  const horizontalAlign = textOption.alignment?.horizontal ?? "center";
  const verticalAlign = textOption.alignment?.vertical ?? "baseline";

  const box = string.write(
    textOption.content,
    x,
    y,
    {
      size,
      font: string.fonts?.[ textOption.font ] ?? string.fonts.martian,
      textAlign: [
        horizontalAlign,
        verticalAlign
      ],
      blendMode: textOption.blend,
      fill: p.color( ...textOption.fill ),
      stroke: p.color( ...textOption.stroke ),
      textWidth,
      textHeight
    }
  );

  // Nothing drawn (empty string / missing font) → no grab zone to report.
  if ( !textOption.content ) {
    return;
  }

  // Where the glyphs VISIBLY are — p5 rect-mode text aligns them inside the
  // (x, y, textWidth, textHeight) layout box, so the drawn pixels can sit far
  // from the (x, y) anchor the drag layer stores. Report an approximate
  // glyph rectangle so the item can be grabbed by what the user sees.
  // Width/height come from the font's measured bounds (clamped to the layout
  // box — word-wrap never draws wider than it).
  const glyphW = Math.min(
    Math.max(
      box?.w ?? textWidth,
      size
    ),
    textWidth
  );
  const glyphH = Math.max(
    box?.h ?? size,
    size
  );

  const left = horizontalAlign === "left"
    ? x
    : horizontalAlign === "right"
      ? x + textWidth - glyphW
      : x + ( textWidth - glyphW ) / 2;

  // Vertical: rect-mode CENTER/BOTTOM/TOP place the glyphs inside the box;
  // BASELINE is not honoured in rect mode and behaves like TOP, but older
  // p5 builds treated it as glyphs-above-y — cover both with a band that
  // spans one glyph height on each side of y.
  let top;
  let boundsH = glyphH;

  switch ( verticalAlign ) {
    case "center":
      top = y + ( textHeight - glyphH ) / 2;
      break;
    case "bottom":
      top = y + textHeight - glyphH;
      break;
    case "top":
      top = y;
      break;
    default: // "baseline"
      top = y - glyphH;
      boundsH = glyphH * 2;
      break;
  }

  reportItemBounds(
    left,
    top,
    glyphW,
    boundsH
  );
}
