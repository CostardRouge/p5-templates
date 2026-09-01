/**
 * @jest-environment jsdom
 */
import {
  getBlobURL, registerBlobUnique, revokeBlob
} from "../blobMap";

let created = 0;

beforeEach( () => {
  created = 0;
  delete window.__blobAssetMap;
  delete window.__blobAssetKeys;

  URL.createObjectURL = jest.fn( () => `blob:test/${ ++created }` );
  URL.revokeObjectURL = jest.fn();
} );

function makeFile(
  name: string, size: number, lastModified = 1
): File {
  const file = new File(
    [
      "x"
    ],
    name,
    {
      type: "image/jpeg",
      lastModified
    }
  );

  Object.defineProperty(
    file,
    "size",
    {
      value: size
    }
  );

  return file;
}

describe(
  "registerBlobUnique",
  () => {
    it(
      "keeps the asked-for path when it is free",
      () => {
        const path = registerBlobUnique(
          "global/images/image.jpg",
          makeFile(
            "image.jpg",
            10
          )
        );

        expect( path ).toBe( "global/images/image.jpg" );
        expect( getBlobURL( path ) ).toBe( "blob:test/1" );
      }
    );

    it(
      // Every pick from an iOS camera roll is named `image.jpg`. Registering
      // the second photo over the first left the sketch on a path whose image
      // it had already cached — the photo simply never changed on screen.
      "gives a different file its own path when the name collides",
      () => {
        const first = registerBlobUnique(
          "global/images/image.jpg",
          makeFile(
            "image.jpg",
            10
          )
        );
        const second = registerBlobUnique(
          "global/images/image.jpg",
          makeFile(
            "image.jpg",
            20
          )
        );
        const third = registerBlobUnique(
          "global/images/image.jpg",
          makeFile(
            "image.jpg",
            30
          )
        );

        expect( first ).toBe( "global/images/image.jpg" );
        expect( second ).toBe( "global/images/image-2.jpg" );
        expect( third ).toBe( "global/images/image-3.jpg" );

        // Each one keeps its own live URL — none was revoked out from under
        // the item still pointing at it.
        expect( getBlobURL( first ) ).toBe( "blob:test/1" );
        expect( getBlobURL( second ) ).toBe( "blob:test/2" );
        expect( getBlobURL( third ) ).toBe( "blob:test/3" );
        expect( URL.revokeObjectURL ).not.toHaveBeenCalled();
      }
    );

    it(
      "reuses the path when the very same file is picked again",
      () => {
        const file = makeFile(
          "image.jpg",
          10
        );

        expect( registerBlobUnique(
          "global/images/image.jpg",
          file
        ) ).toBe( "global/images/image.jpg" );
        expect( registerBlobUnique(
          "global/images/image.jpg",
          file
        ) ).toBe( "global/images/image.jpg" );
      }
    );

    it(
      "suffixes before the extension, and at the end when there is none",
      () => {
        registerBlobUnique(
          "slide-1/videos/clip.mp4",
          makeFile(
            "clip.mp4",
            10
          )
        );

        expect( registerBlobUnique(
          "slide-1/videos/clip.mp4",
          makeFile(
            "clip.mp4",
            20
          )
        ) ).toBe( "slide-1/videos/clip-2.mp4" );

        registerBlobUnique(
          "global/images/photo",
          makeFile(
            "photo",
            10
          )
        );

        expect( registerBlobUnique(
          "global/images/photo",
          makeFile(
            "photo",
            20
          )
        ) ).toBe( "global/images/photo-2" );
      }
    );

    it(
      "frees a path again once its blob is revoked",
      () => {
        const path = registerBlobUnique(
          "global/images/image.jpg",
          makeFile(
            "image.jpg",
            10
          )
        );

        revokeBlob( path );

        expect( registerBlobUnique(
          "global/images/image.jpg",
          makeFile(
            "image.jpg",
            20
          )
        ) ).toBe( "global/images/image.jpg" );
      }
    );
  }
);
