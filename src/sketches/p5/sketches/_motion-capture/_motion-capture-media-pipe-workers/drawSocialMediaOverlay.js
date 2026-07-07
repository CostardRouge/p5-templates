import events from "@/p5/utils/events.js";
import string from "@/p5/utils/string.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

let qrCode = undefined;

events.register(
  "engine-window-preload",
  () => {
    qrCode = getP5().loadImage( "/assets/scripts/p5-sketches/sketches/_motion-capture-media-pipe-workers/instagram.png" );
  }
);

export default function drawSocialMediaOverlay(
  text, {
    graphics
  }
) {
  const qrCodeMargin = 10;
  const qrCodeWidth = qrCode.width * 0.5;
  const qrCodeHeight = qrCode.height * 0.5;

  const bottomLinePosition = p.height - ( qrCodeHeight + qrCodeMargin );

  graphics.image(
    qrCode,
    p.width - qrCodeMargin - qrCodeWidth,
    bottomLinePosition,
    qrCodeWidth,
    qrCodeHeight
  );

  string.write(
    text,
    qrCodeMargin,
    qrCodeMargin,
    {
      size: qrCodeHeight * 0.3,
      font: string.fonts?.martian,
      stroke: p.color( 0 ),
      fill: p.color( 255 ),
      textWidth: p.width - 2 * qrCodeMargin - qrCodeWidth,
      textHeight: qrCodeHeight,
      textAlign: [
        p.LEFT,
        p.TOP
      ],
      popPush: true,
      graphics: graphics
    }
  );
}
