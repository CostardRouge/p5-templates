export default function getSketchPreviewURL(
  engine: string, name: string, variant?: "md"
) {
  const file = variant === "md" ? "preview-md.webm" : "preview.webm";

  return `/assets/images/templates/${ engine }/${ name }/${ file }`;
}
