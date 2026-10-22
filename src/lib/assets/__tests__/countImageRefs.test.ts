/**
 * Unit tests for the content-item reference counter behind
 * `useAssetsBridge.maybeRemoveFromAssets`. It read `src` / `items` while the
 * schema names the fields `source` / `sources`, so it always returned 0 and an
 * image was dropped from the pool while a content item still showed it.
 */
import countImageRefs from "../countImageRefs";

const target = "global/images/dune.jpg";

describe(
  "countImageRefs",
  () => {
    it(
      "counts an image item by its `source`",
      () => {
        expect( countImageRefs(
          {
            slides: [
              {
                content: [
                  {
                    type: "image",
                    source: target
                  },
                  {
                    type: "image",
                    source: "global/images/other.jpg"
                  }
                ]
              }
            ]
          },
          target
        ) ).toBe( 1 );
      }
    );

    it(
      "counts every occurrence in an images-stack's `sources`",
      () => {
        expect( countImageRefs(
          {
            slides: [
              {
                content: [
                  {
                    type: "images-stack",
                    sources: [
                      target,
                      "global/images/other.jpg",
                      target
                    ]
                  }
                ]
              }
            ]
          },
          target
        ) ).toBe( 2 );
      }
    );

    it(
      "scans the root content list as well as every slide",
      () => {
        expect( countImageRefs(
          {
            content: [
              {
                type: "image",
                source: target
              }
            ],
            slides: [
              {
                content: [
                  {
                    type: "images-stack",
                    sources: [
                      target
                    ]
                  }
                ]
              },
              {
                content: [
                  {
                    type: "image",
                    source: target
                  }
                ]
              }
            ]
          },
          target
        ) ).toBe( 3 );
      }
    );

    it(
      "ignores the legacy `src` / `items` names and other item types",
      () => {
        expect( countImageRefs(
          {
            content: [
              {
                type: "image",
                src: target
              },
              {
                type: "images-stack",
                items: [
                  target
                ]
              },
              {
                type: "text",
                source: target
              }
            ]
          },
          target
        ) ).toBe( 0 );
      }
    );

    it(
      "tolerates missing or malformed values",
      () => {
        expect( countImageRefs(
          undefined,
          target
        ) ).toBe( 0 );
        expect( countImageRefs(
          {
            content: "nope",
            slides: [
              null,
              {},
              {
                content: [
                  null,
                  {
                    type: "images-stack"
                  }
                ]
              }
            ]
          },
          target
        ) ).toBe( 0 );
      }
    );
  }
);
