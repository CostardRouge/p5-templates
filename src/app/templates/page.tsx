import getSketchList from "@/utils/getSketchList";
import TemplatesList from "@/components/TemplatesList";
import getP5SketchThumbnailURL from "@/utils/getP5SketchThumbnailURL";

export type TemplateCategory = Array<{
  href: string,
  name: string,
  thumbnail: string,
  hasSketchForm: boolean,
  category?: string | null
}>

export default async function TemplatesPage() {
  const p5sketches = await getSketchList() ?? [
  ];

  const p5sketchNames = p5sketches
    .map( ( {
      name, category, hasSketchForm
    } ) => ( {
      thumbnail: getP5SketchThumbnailURL( name ),
      href: `templates/p5/${ name }`,
      hasSketchForm,
      name,
      category
    } ) )
    .reverse();

  const templates: Record<string, TemplateCategory> = {
    p5: p5sketchNames,
    html: [
      {
        thumbnail: "assets/images/templates/html/exif-detail/thumbnail.jpg",
        href: "templates/html/exif-detail",
        hasSketchForm: false,
        name: "exif-detail"
      }
    ],
  };

  return (
    <div className="p-3 sm:p-6">
      <TemplatesList templates={templates} />
    </div>
  );
}
