import QRCode from "qrcode";

import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";

// Query params injected by the headless capture pipeline (see the studio
// route). They are stripped from the auto-detected URL so a recorded or
// thumbnailed QR still points at the real experience, not the capture URL.
const CAPTURE_PARAMS = [
  "capturing",
  "previewFramerate",
  "previewDuration"
];

function resolveUrl( explicit ) {
  if ( typeof explicit === "string" && explicit.trim() ) {
    return explicit.trim();
  }

  if ( typeof window === "undefined" || !window?.location?.href ) {
    return "";
  }

  try {
    const url = new URL( window.location.href );

    CAPTURE_PARAMS.forEach( ( param ) => url.searchParams.delete( param ) );

    return url.toString();
  } catch {
    return window.location.href;
  }
}

// Encoding a QR matrix is comparatively expensive, so memoise the last few
// (url + error-correction) combinations instead of rebuilding every frame.
const matrixCache = new Map();

function getMatrix(
  text, errorCorrectionLevel
) {
  const key = `${ errorCorrectionLevel }::${ text }`;

  if ( !matrixCache.has( key ) ) {
    if ( matrixCache.size > 16 ) {
      matrixCache.clear();
    }

    try {
      matrixCache.set(
        key,
        QRCode.create(
          text,
          {
            errorCorrectionLevel
          }
        )
      );
    } catch {
      // Text too long for a QR symbol, or any other encoder error: cache the
      // failure so we don't retry it every frame.
      matrixCache.set(
        key,
        null
      );
    }
  }

  return matrixCache.get( key );
}

export default function drawSlideQrCode( qrCodeOption ) {
  const p = getP5();
  const text = resolveUrl( qrCodeOption.url );

  if ( !text ) {
    return;
  }

  const qr = getMatrix(
    text,
    qrCodeOption.errorCorrection || "M"
  );

  if ( !qr ) {
    return;
  }

  const moduleCount = qr.modules.size;
  const moduleData = qr.modules.data;
  const quietZone = qrCodeOption.quietZone ?? 4;
  const totalModules = moduleCount + quietZone * 2;

  const side =
    Math.max(
      qrCodeOption.size ?? 0.22,
      0
    ) * Math.min(
      p.width,
      p.height
    );

  if ( side <= 0 ) {
    return;
  }

  const moduleSize = side / totalModules;
  const centerX = ( qrCodeOption.position?.x ?? 0.5 ) * p.width;
  const centerY = ( qrCodeOption.position?.y ?? 0.82 ) * p.height;
  const left = centerX - side / 2;
  const top = centerY - side / 2;

  p.push();

  if ( sketch.sketchOptions?.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  if ( qrCodeOption.blend ) {
    p.blendMode( qrCodeOption.blend );
  }

  p.noStroke();

  // Backdrop, including the quiet zone. A transparent alpha keeps it
  // see-through, but scanning still needs enough contrast behind the code.
  p.fill( ...qrCodeOption.background );
  p.rect(
    Math.round( left ),
    Math.round( top ),
    Math.round( left + side ) - Math.round( left ),
    Math.round( top + side ) - Math.round( top )
  );

  // Dark modules. Edges are snapped to integer pixels so adjacent modules
  // share an exact boundary (no anti-aliasing seams, no double-blended
  // overlap with translucent foregrounds).
  p.fill( ...qrCodeOption.foreground );

  for ( let row = 0; row < moduleCount; row++ ) {
    for ( let col = 0; col < moduleCount; col++ ) {
      if ( !moduleData[ row * moduleCount + col ] ) {
        continue;
      }

      const x0 = Math.round( left + ( quietZone + col ) * moduleSize );
      const y0 = Math.round( top + ( quietZone + row ) * moduleSize );
      const x1 = Math.round( left + ( quietZone + col + 1 ) * moduleSize );
      const y1 = Math.round( top + ( quietZone + row + 1 ) * moduleSize );

      p.rect(
        x0,
        y0,
        x1 - x0,
        y1 - y0
      );
    }
  }

  // URL caption under the code.
  if ( qrCodeOption.showUrl ) {
    const captionWidth = Math.min(
      p.width * 0.92,
      Math.max(
        side * 1.5,
        side
      )
    );
    const urlSize = Number( qrCodeOption.urlSize ?? 20 );

    string.write(
      text,
      centerX - captionWidth / 2,
      top + side + urlSize,
      {
        size: urlSize,
        font: string.fonts?.[ qrCodeOption.urlFont ] ?? string.fonts.spaceMonoRegular,
        fill: p.color( ...qrCodeOption.urlFill ),
        stroke: false,
        strokeWeight: 0,
        textWidth: captionWidth,
        textAlign: [
          p.CENTER,
          p.TOP
        ]
      }
    );
  }

  p.pop();
}
