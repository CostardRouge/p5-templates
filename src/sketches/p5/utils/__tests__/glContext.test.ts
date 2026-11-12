/**
 * WebGL contexts are released by hand when a p5 instance goes.
 *
 * `p5.remove()` detaches canvases and nothing more, and an offscreen WEBGL
 * buffer stays reachable from the GPU helper that made it, so every shader
 * sketch visited kept one of the page's few contexts alive — until the browser
 * refused the next one ("Error creating webgl context"). These tests pin the
 * release itself and the two teardown paths that must call it BEFORE remove().
 */

import fs from "fs";
import path from "path";

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  isWebGLUnavailable,
  releaseGlContext,
  releaseInstanceContexts,
  removeGraphics,
  toWebGLUnavailableError,
  WEBGL_UNAVAILABLE
} = require( "@/p5/utils/glContext.js" );
/* eslint-enable @typescript-eslint/no-require-imports */

function fakeGl( {
  lost = false
} = {} ) {
  const loseContext = jest.fn();
  const canvas = {
    width: 1080,
    height: 1350
  };

  return {
    canvas,
    loseContext,
    gl: {
      canvas,
      isContextLost: () => lost,
      getExtension: ( name: string ) => name === "WEBGL_lose_context"
        ? {
          loseContext
        }
        : null
    }
  };
}

describe(
  "releaseGlContext",
  () => {
    it(
      "loses the context and shrinks its canvas",
      () => {
        const {
          gl, canvas, loseContext
        } = fakeGl();

        expect( releaseGlContext( {
          drawingContext: gl
        } ) ).toBe( true );
        expect( loseContext ).toHaveBeenCalledTimes( 1 );
        expect( canvas ).toEqual( {
          width: 1,
          height: 1
        } );
      }
    );

    it(
      "does not lose a context twice",
      () => {
        const {
          gl, loseContext
        } = fakeGl( {
          lost: true
        } );

        expect( releaseGlContext( {
          drawingContext: gl
        } ) ).toBe( true );
        expect( loseContext ).not.toHaveBeenCalled();
      }
    );

    it(
      "leaves a 2D surface alone",
      () => {
        const canvas = {
          width: 300,
          height: 200
        };

        expect( releaseGlContext( {
          drawingContext: {
            canvas,
            fillRect: () => {}
          }
        } ) ).toBe( false );
        expect( canvas.width ).toBe( 300 );
        expect( releaseGlContext( null ) ).toBe( false );
      }
    );

    it(
      "survives a browser that throws on a dead context",
      () => {
        expect( () => releaseGlContext( {
          drawingContext: {
            isContextLost: () => false,
            getExtension: () => {
              throw new Error( "gone" );
            }
          }
        } ) ).not.toThrow();
      }
    );
  }
);

describe(
  "releaseInstanceContexts",
  () => {
    it(
      "releases the WEBGL canvas and every WEBGL buffer, and only those",
      () => {
        const main = fakeGl();
        const buffer = fakeGl();
        const other = fakeGl();
        const renderer = {
          drawingContext: main.gl
        };

        const released = releaseInstanceContexts( {
          _renderer: renderer,
          _elements: [
            // p5 records the main renderer in _elements too: once, not twice.
            renderer,
            {
              drawingContext: buffer.gl
            },
            {
              _renderer: {
                drawingContext: other.gl
              }
            },
            {
              drawingContext: {
                fillRect: () => {}
              }
            },
            {
              elt: {}
            }
          ]
        } );

        expect( released ).toBe( 3 );
        expect( main.loseContext ).toHaveBeenCalledTimes( 1 );
        expect( buffer.loseContext ).toHaveBeenCalledTimes( 1 );
        expect( other.loseContext ).toHaveBeenCalledTimes( 1 );
        expect( releaseInstanceContexts( null ) ).toBe( 0 );
      }
    );

    it(
      "releases a buffer before removing it",
      () => {
        const {
          gl, loseContext
        } = fakeGl();
        const order: string[] = [];

        loseContext.mockImplementation( () => order.push( "lose" ) );

        removeGraphics( {
          drawingContext: gl,
          remove: () => order.push( "remove" )
        } );

        expect( order ).toEqual( [
          "lose",
          "remove"
        ] );
      }
    );
  }
);

describe(
  "a refused context",
  () => {
    it(
      "is recognised from p5's own error and reworded for the page",
      () => {
        const thrown = new Error( "Error creating webgl context" );

        expect( isWebGLUnavailable( thrown ) ).toBe( true );
        expect( isWebGLUnavailable( new Error( "x is not a function" ) ) ).toBe( false );
        expect( isWebGLUnavailable( undefined ) ).toBe( false );

        const failure = toWebGLUnavailableError( thrown );

        expect( failure.name ).toBe( WEBGL_UNAVAILABLE );
        expect( failure.cause ).toBe( thrown );
        expect( failure.message ).toMatch( /WebGL/ );
        expect( isWebGLUnavailable( failure ) ).toBe( true );
      }
    );
  }
);

describe(
  "the teardown paths",
  () => {
    const read = ( file: string ) => fs.readFileSync(
      path.join(
        process.cwd(),
        file
      ),
      "utf8"
    );

    // Releasing after remove() would find `_elements` already emptied of the
    // buffers a disposer removed, and a p5 instance half torn down.
    it.each( [
      [
        "src/engines/p5/P5Engine.ts",
        /releaseInstanceContexts\( instance \);\s+instance\?\.remove\(\);/
      ],
      [
        "src/sketches/p5/utils/sketch.js",
        /releaseInstanceContexts\( previous \);\s+previous\.remove\(\);/
      ]
    ] )(
      "%s releases the contexts right before remove()",
      (
        file, pattern
      ) => {
        expect( read( file ) ).toMatch( pattern );
      }
    );
  }
);
