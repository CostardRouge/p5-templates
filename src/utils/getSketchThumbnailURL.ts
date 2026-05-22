export default function getSketchThumbnailURL(
  engine: string, name: string
) {
  return `/assets/images/templates/${ engine }/${ name }/thumbnail.webp`;
}
