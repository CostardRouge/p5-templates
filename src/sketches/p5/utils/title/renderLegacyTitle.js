import string from "../string.js";
import {
  getP5
} from "../sketch.js";

// The historical hand-capture splash: a big centred title (martian, EXCLUSION
// blend) with an italic subtitle underneath. Kept as a shared "legacy"
// renderer so any sketch wanting this exact style imports it instead of
// duplicating it — the styled/animated path is the "title" content item.
export default function renderLegacyTitle( {
  title = "",
  subtitle = "",
  color
} = {} ) {
  if ( !title && !subtitle ) {
    return;
  }

  const p = getP5();
  const fill = color ? p.color( ...color ) : p.color( 0 );

  if ( title ) {
    string.write(
      title,
      0,
      p.height / 2,
      {
        size: 172,
        strokeWeight: 0,
        stroke: fill,
        fill,
        font: string.fonts.martian,
        textAlign: [
          p.CENTER,
          p.CENTER
        ],
        blendMode: p.EXCLUSION
      }
    );
  }

  if ( subtitle ) {
    string.write(
      subtitle,
      0,
      ( p.height * 6 ) / 10,
      {
        size: 32,
        strokeWeight: 0,
        stroke: fill,
        fill,
        font: string.fonts.loraItalic,
        textAlign: [
          p.CENTER,
          p.CENTER
        ],
        blendMode: p.EXCLUSION
      }
    );
  }
}
