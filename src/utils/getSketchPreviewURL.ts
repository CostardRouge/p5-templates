export default function getSketchPreviewURL(
  engine: string, name: string
) {
  return `/assets/images/templates/${ engine }/${ name }/preview.webm`;
}
