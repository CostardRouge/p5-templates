import getSketchList from "@/utils/getSketchList";

export default async function Home() {
  const p5sketches = await getSketchList();
  const p5sketchNames = p5sketches.map( p5sketchFileName => (
    `/p5/${ p5sketchFileName }`
  ) );

  const templates = {
    html: [
      "/html/exif-detail"
    ],
    p5: p5sketchNames
  };

  return (
    <div className="bg-white min-h-screen p-8">
      <main className="flex items-center">
        <ul>
          {
            Object.entries( templates ).map( ( [
              templateCategory,
              categoryTemplates
            ] ) => (
              <li key={ templateCategory } className="mt-8">
                <span className="underline">{ templateCategory }</span>
                <ul className="ml-3">
                  {
                    categoryTemplates.map( (
                      categoryTemplate, index
                    ) => (
                      <li key={ categoryTemplate }>
                        <a
                          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
                          href={ categoryTemplate }
                          rel="noopener noreferrer"
                        >
                          { categoryTemplate }
                        </a>
                      </li>
                    ) )
                  }
                </ul>
              </li>
            ) )
          }
        </ul>
      </main>
    </div>
  );
}
