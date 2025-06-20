import getSketchList from "@/utils/getSketchList";
import TemplatesList from "@/components/TemplatesList";

export type TemplateCategory = Array<{
  href: string,
  name: string,
  thumbnail: string,
}>

export default async function TemplatesPage() {
  const p5sketches = await getSketchList();
  const p5sketchNames = p5sketches
    .map( ( name ) => ( {
      thumbnail: `assets/scripts/p5-sketches/sketches/${ name }/thumbnail.jpeg`,
      href: `templates/p5/${ name }`,
      name
    } ) );

  const templates: Record<string, TemplateCategory> = {
    p5: p5sketchNames,
    html: [
      {
        thumbnail: "assets/images/templates/exif-detail/thumbnail.jpg",
        href: "templates/html/exif-detail",
        name: "exif-detail"
      }
    ],
  };

  return <TemplatesList templates={templates} />;
}
