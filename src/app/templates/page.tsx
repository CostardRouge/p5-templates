import getSketchList from "@/utils/getSketchList";
import TemplatesList from "@/components/TemplatesList";

export type TemplateCategory = Array<{
  href: string,
  name: string,
}>

export default async function TemplatesPage() {
  const p5sketches = await getSketchList();
  const p5sketchNames = p5sketches
    .map( ( file ) => ( {
      href: `templates/p5/${ file }`,
      name: file
    } ) );

  const templates: Record<string, TemplateCategory> = {
    p5: p5sketchNames,
    html: [
      {
        href: "templates/html/exif-detail",
        name: "exif-detail"
      }
    ],
  };

  return <TemplatesList templates={templates} />;
}
