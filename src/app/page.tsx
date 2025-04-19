import listDirectory from "@/utils/listDirectory";
import minifyAndEncodeCaptureOptions from "@/utils/minifyAndEncodeCaptureOptions";

export default async function Home() {
  const p5sketchesFolderFileNames = await listDirectory("public/assets/scripts/p5-sketches/sketches");
  const testImageFileNames = await listDirectory("public/assets/images/test");

  const acceptedImageTypes = ["png", "jpg", "arw", "jpeg", "webp"];

  const captureOptions = {
    texts: {
      title: "SYNDEY\nPHOTO\nDUMP"
    },
    size: {
      width: 1080,
      height: 1350
    },
    count: 20,
    // rotate: true,
    zoom: true,
    animationProgression: "linearProgression",
    // animationProgression: "triangleProgression",
    animation: {
      duration: 9,
      framerate: 60,
    },
    assets: testImageFileNames
        .filter( testImageFileName => acceptedImageTypes.includes(testImageFileName.split(".")[1]) )
        .map( testImageFileName => `/assets/images/test/${testImageFileName}` )
  }

  const p5sketchNames = p5sketchesFolderFileNames
      .filter( p5sketchFileName => p5sketchFileName.endsWith(".js") )
      .map( p5sketchFileName => `/p5/${p5sketchFileName.replace(".js", "")}` )
      .map( p5sketchFilePath => `${p5sketchFilePath}` );

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
            Object.entries(templates).map( ( [ templateCategory, categoryTemplates ]) => (
              <li key={ templateCategory } className="mt-8">
                <span className="underline">{ templateCategory }</span>
                <ul className="ml-3">
                  {
                    categoryTemplates.map( ( categoryTemplate, index ) => (
                        <li key={ categoryTemplate }>
                          <a
                              className="flex items-center gap-2 hover:underline hover:underline-offset-4"
                              href={ `${categoryTemplate}?captureOptions=${minifyAndEncodeCaptureOptions(captureOptions)}` }
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
