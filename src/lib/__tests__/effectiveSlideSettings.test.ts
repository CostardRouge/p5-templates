import {
  getEffectiveSlideSettings,
  mergeSlideOverride
} from "@/lib/effectiveSlideSettings";

describe(
  "mergeSlideOverride",
  () => {
    test(
      "returns the global value when there is no override",
      () => {
        const globalValue = {
          framerate: 60,
          duration: 12
        };

        expect( mergeSlideOverride(
          globalValue,
          undefined
        ) ).toBe( globalValue );
        expect( mergeSlideOverride(
          globalValue,
          null
        ) ).toBe( globalValue );
      }
    );

    test(
      "fills the missing keys of a partial override from the global value",
      () => {
        expect( mergeSlideOverride(
          {
            framerate: 60,
            duration: 12
          },
          {
            framerate: 24
          }
        ) ).toEqual( {
          framerate: 24,
          duration: 12
        } );
      }
    );

    test(
      "returns the override when there is no global value",
      () => {
        expect( mergeSlideOverride(
          undefined,
          {
            framerate: 24
          }
        ) ).toEqual( {
          framerate: 24
        } );
      }
    );
  }
);

describe(
  "getEffectiveSlideSettings",
  () => {
    const options = {
      size: {
        width: 1920,
        height: 1080
      },
      animation: {
        framerate: 60,
        duration: 12
      },
      slides: [
        {
          name: "full override",
          size: {
            width: 1080,
            height: 1350
          },
          animation: {
            framerate: 24,
            duration: 4
          }
        },
        {
          name: "partial animation override",
          animation: {
            framerate: 30
          }
        },
        {
          name: "no overrides"
        }
      ]
    };

    test(
      "global settings without a slide index",
      () => {
        expect( getEffectiveSlideSettings( options ) ).toEqual( {
          size: {
            width: 1920,
            height: 1080
          },
          animation: {
            framerate: 60,
            duration: 12
          }
        } );
      }
    );

    test(
      "full per-slide override wins",
      () => {
        expect( getEffectiveSlideSettings(
          options,
          0
        ).animation ).toEqual( {
          framerate: 24,
          duration: 4
        } );
      }
    );

    test(
      "partial per-slide override keeps the global duration",
      () => {
        expect( getEffectiveSlideSettings(
          options,
          1
        ).animation ).toEqual( {
          framerate: 30,
          duration: 12
        } );
      }
    );

    test(
      "slide without overrides falls back to globals",
      () => {
        expect( getEffectiveSlideSettings(
          options,
          2
        ) ).toEqual( {
          size: {
            width: 1920,
            height: 1080
          },
          animation: {
            framerate: 60,
            duration: 12
          }
        } );
      }
    );

    test(
      "out-of-range slide index falls back to globals",
      () => {
        expect( getEffectiveSlideSettings(
          options,
          99
        ).animation ).toEqual( {
          framerate: 60,
          duration: 12
        } );
      }
    );
  }
);
