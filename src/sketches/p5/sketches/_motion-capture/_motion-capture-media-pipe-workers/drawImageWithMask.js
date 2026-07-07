import imageUtils from "@/p5/utils/imageUtils.js";

export default function drawImageWithMask( {
  img,
  maskDrawer,
  graphics = getP5(),
  mask,
  imageBuffer
} ) {
  imageUtils.marginImage( {
    img,
    fill: true,
    center: true,
    graphics: imageBuffer
  } );

  // Clean mask
  mask.erase();
  mask.rect(
    0,
    0,
    graphics.width,
    graphics.height
  );
  mask.noErase();

  maskDrawer?.( mask );

  const maskedImage = imageBuffer.get();

  maskedImage.mask( mask );

  graphics.image(
    maskedImage,
    0,
    0,
    graphics.width,
    graphics.height
  );
}
