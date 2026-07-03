import QRCode from "qrcode";

import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";
import {
  buildQrUrl, stripScheme
} from "./qrCodeUrl.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

// Inlined at build time by Next for NEXT_PUBLIC_* vars, so it is readable in
// the client/headless sketch bundle. Lets a localhost dev machine encode the
// production domain instead of "localhost".
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

function resolveUrl( domainOverride ) {
  return buildQrUrl( {
    domainOverride,
    siteUrl: SITE_URL,
    href:
      typeof window !== "undefined" && window.location
        ? window.location.href
        : ""
  } );
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
  const text = resolveUrl( qrCodeOption.domainOverride );

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

  // Exact drawn square, for the on-canvas drag's hit-test.
  reportItemBounds(
    left,
    top,
    side,
    side
  );

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
      stripScheme( text ),
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
