/**
 * @jest-environment jsdom
 *
 * Tests for the per-item render phase ("back" = behind the sketch, "front" =
 * on top — the historical default) and the opt-in delegated background.
 *
 * freeLayout draws one phase per pass: the pre-draw pass renders "back" items
 * under the sketch, the post-draw pass renders "front" (and legacy unphased)
 * items on top. backgroundLayer captures a delegated sketch's first opaque
 * background() call so the engine can repaint it under back-phase items
 * instead of letting it erase them.
 *
 * freeLayout's real signature is (options, scope, phase) — scope drives the
 * on-canvas drag system (contentDrag.js) and is irrelevant here, so these
 * tests pass it through as undefined and target phase explicitly.
 */

jest.mock(
  "../slides/common/drawSlideVisual.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideMeta.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideSpecs.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideHud.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideText.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideImage.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideImages.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideBackground.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideImagesStack.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);
jest.mock(
  "../slides/common/drawSlideQrCode.js",
  () => ( {
    __esModule: true,
    default: jest.fn()
  } )
);

// backgroundLayer reads the delegation flag from the live options proxy; a
// mutable mock lets each test flip it without the real store machinery.
const mockLiveOptions: {
  sketch: Record<string, unknown>;
} = {
  sketch: {}
};

jest.mock(
  "../options.js",
  () => ( {
    __esModule: true,
    default: mockLiveOptions
  } )
);

import freeLayout from "../slides/layouts/freeLayout.js";
import drawSlideSpecs from "../slides/common/drawSlideSpecs.js";
import drawSlideText from "../slides/common/drawSlideText.js";
import drawSlideBackground from "../slides/common/drawSlideBackground.js";

import {
  install,
  beginSketchDraw,
  endSketchDraw,
  paintBase,
  isDelegated
} from "../backgroundLayer.js";

function createFakeP5() {
  const calls: unknown[][] = [];

  const p: any = {
    background: ( ...args: unknown[] ) => {
      calls.push( args );
    }
  };

  return {
    p,
    calls
  };
}

describe(
  "freeLayout render phases",
  () => {
    beforeEach( () => {
      jest.clearAllMocks();
    } );

    const content = [
      {
        type: "background",
        phase: "back"
      },
      {
        type: "specs",
        phase: "back"
      },
      {
        type: "text"
      }, // legacy item without a phase
      {
        type: "specs",
        phase: "front"
      }
    ];

    it(
      "defaults to the front pass: unphased + front items only",
      () => {
        freeLayout( {
          content
        } );

        expect( drawSlideBackground ).not.toHaveBeenCalled();
        expect( drawSlideText ).toHaveBeenCalledTimes( 1 );
        expect( drawSlideSpecs ).toHaveBeenCalledTimes( 1 );
        expect( drawSlideSpecs ).toHaveBeenCalledWith( content[ 3 ] );
      }
    );

    it(
      "back pass renders only back items",
      () => {
        freeLayout(
          {
            content
          },
          undefined,
          "back"
        );

        expect( drawSlideBackground ).toHaveBeenCalledTimes( 1 );
        expect( drawSlideText ).not.toHaveBeenCalled();
        expect( drawSlideSpecs ).toHaveBeenCalledTimes( 1 );
        expect( drawSlideSpecs ).toHaveBeenCalledWith( content[ 1 ] );
      }
    );

    it(
      "tolerates empty options",
      () => {
        expect( () => freeLayout( undefined as any ) ).not.toThrow();
        expect( () => freeLayout(
          {},
          undefined,
          "back"
        ) ).not.toThrow();
      }
    );
  }
);

describe(
  "backgroundLayer delegated background",
  () => {
    beforeEach( () => {
      mockLiveOptions.sketch = {};
      endSketchDraw();
    } );

    it(
      "is inert without the flag: background paints as usual",
      () => {
        const {
          p, calls
        } = createFakeP5();

        install( p );
        expect( isDelegated() ).toBe( false );

        beginSketchDraw();
        p.background(
          10,
          20,
          30
        );
        endSketchDraw();

        expect( calls ).toEqual( [
          [
            10,
            20,
            30
          ]
        ] );
      }
    );

    it(
      "captures the first opaque call and repaints it via paintBase",
      () => {
        const {
          p, calls
        } = createFakeP5();

        install( p );
        mockLiveOptions.sketch = {
          delegateBackground: true
        };

        beginSketchDraw();
        p.background(
          10,
          20,
          30
        );
        endSketchDraw();

        // Suppressed inside the sketch draw…
        expect( calls ).toEqual( [] );

        // …and repainted by the engine at the bottom of the next frame.
        paintBase();
        expect( calls ).toEqual( [
          [
            10,
            20,
            30
          ]
        ] );
      }
    );

    it(
      "lets translucent (trail) backgrounds through, including array form",
      () => {
        const {
          p, calls
        } = createFakeP5();

        install( p );
        mockLiveOptions.sketch = {
          delegateBackground: true
        };

        beginSketchDraw();
        p.background(
          0,
          0,
          0,
          40
        );
        p.background( [
          0,
          0,
          0,
          40
        ] );
        endSketchDraw();

        expect( calls ).toHaveLength( 2 );

        // Nothing captured — paintBase stays a no-op.
        paintBase();
        expect( calls ).toHaveLength( 2 );
      }
    );

    it(
      "passes later opaque calls through (intentional mid-frame repaints)",
      () => {
        const {
          p, calls
        } = createFakeP5();

        install( p );
        mockLiveOptions.sketch = {
          delegateBackground: true
        };

        beginSketchDraw();
        p.background( 0 ); // captured
        p.background( 255 ); // mid-frame repaint, painted
        endSketchDraw();

        expect( calls ).toEqual( [
          [
            255
          ]
        ] );

        // Next frame captures again.
        beginSketchDraw();
        p.background( 0 );
        endSketchDraw();
        expect( calls ).toHaveLength( 1 );
      }
    );

    it(
      "leaves content items untouched outside the sketch-draw window",
      () => {
        const {
          p, calls
        } = createFakeP5();

        install( p );
        mockLiveOptions.sketch = {
          delegateBackground: true
        };

        // e.g. drawSlideBackground running in a freeLayout pass
        p.background(
          1,
          2,
          3
        );

        expect( calls ).toEqual( [
          [
            1,
            2,
            3
          ]
        ] );
      }
    );

    it(
      "install rebinds cleanly on a fresh p5 instance",
      () => {
        const first = createFakeP5();

        install( first.p );
        mockLiveOptions.sketch = {
          delegateBackground: true
        };

        beginSketchDraw();
        first.p.background( 7 );
        endSketchDraw();

        const second = createFakeP5();

        install( second.p );

        // The capture from the previous instance is dropped with the rebind.
        paintBase();
        expect( second.calls ).toEqual( [] );
        expect( first.calls ).toEqual( [] );
      }
    );
  }
);
