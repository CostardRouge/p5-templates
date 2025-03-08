const templates = {
  html: [
    "/html/exif-detail"
  ],
  p5: [
    "/p5/test",
    "/p5/letter-3d-show",

    "/p5/photo-switch",
    "/p5/photo-unzoom",
    "/p5/photo-stack-center",
    "/p5/photo-stack-top-bottom",

    "/p5/vertical-3d-photo-stack"
  ]
}

export default function Home() {
  return (
    <div className="bg-white min-h-screen p-8">
      <main className="flex items-center">

        <ul>
          {
            Object.entries(templates).map( ( [ templateCategory, categoryTemplates ]) => (
              <li key={ templateCategory } className="mt-8">
                <span className="underline">{ templateCategory }</span>
                <ul className="ml-3">
                  {
                    categoryTemplates.map( ( categoryTemplate, index ) => (
                        <li key={ categoryTemplate }>
                          <a
                              className="flex items-center gap-2 hover:underline hover:underline-offset-4"
                              href={ categoryTemplate }
                              rel="noopener noreferrer"
                          >
                            { categoryTemplate }
                          </a>
                        </li>
                    ))
                  }
                </ul>
              </li>
            ))
          }
        </ul>
      </main>
    </div>
  );
}
