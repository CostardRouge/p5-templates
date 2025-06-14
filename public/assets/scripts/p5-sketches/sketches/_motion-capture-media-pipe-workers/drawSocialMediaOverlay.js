import {
  mappers, animation, colors, events, grid, easing, string
} from "/assets/scripts/p5-sketches/utils/index.js";

let qrCode = undefined;

events.register(
  "engine-window-preload",
  () => {
    qrCode = loadImage( "/assets/scripts/p5-sketches/sketches/_motion-capture-media-pipe-workers/instagram.png" );
  }
);

export default function drawSocialMediaOverlay(
  text, {
    graphics
  },
) {
  const qrCodeMargin = 20;
  const qrCodeWidth = qrCode.width * 0.4;
  const qrCodeHeight = qrCode.height * 0.4;

  const bottomLinePosition = height - ( qrCodeHeight + qrCodeMargin );

  graphics.image(
    qrCode,
    width - qrCodeMargin - qrCodeWidth,
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
      stroke: color( 0 ),
      fill: color( 255 ),
      textWidth: width - ( 2 * qrCodeMargin ) - qrCodeWidth,
      textHeight: qrCodeHeight,
      textAlign: [
        LEFT,
        TOP
      ],
      popPush: true,
      graphics: graphics
    }
  );
}
