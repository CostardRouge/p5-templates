/**
 * The vector map's two readings of one position. The invariant worth a test:
 * `coordinates` only changes the printed line — the fraction that places the
 * dot is the same either way, so switching the mode never moves the point.
 */

import {
  vectorCoordinatesText, vectorFractions
} from "../vectorMap.js";

const canvas = {
  width: 1080,
  height: 1350
};

describe(
  "vectorFractions",
  () => {
    it(
      "maps a parameter-space point over its own [min, max] domain",
      () => {
        expect( vectorFractions(
          {
            x: 0.25,
            y: 0.5
          },
          {
            space: "value",
            min: 0,
            max: 1
          },
          canvas
        ) ).toEqual( {
          fx: 0.25,
          fy: 0.5
        } );

        // A direction vector: 0 sits at the middle of a [-1, 1] pad.
        expect( vectorFractions(
          {
            x: 0,
            y: 1
          },
          {
            space: "value",
            min: -1,
            max: 1
          },
          canvas
        ) ).toEqual( {
          fx: 0.5,
          fy: 1
        } );
      }
    );

    it(
      "maps a canvas-space point over the canvas itself",
      () => {
        expect( vectorFractions(
          {
            x: 540,
            y: 675
          },
          {
            space: "canvas"
          },
          canvas
        ) ).toEqual( {
          fx: 0.5,
          fy: 0.5
        } );
      }
    );

    it(
      "survives a zero-width domain instead of returning NaN",
      () => {
        const {
          fx
        } = vectorFractions(
          {
            x: 2,
            y: 2
          },
          {
            space: "value",
            min: 1,
            max: 1
          },
          canvas
        );

        expect( Number.isFinite( fx ) ).toBe( true );
      }
    );

    it(
      "does not clamp: only the plotting does",
      () => {
        expect( vectorFractions(
          {
            x: 2,
            y: -1
          },
          {
            space: "value",
            min: 0,
            max: 1
          },
          canvas
        ) ).toEqual( {
          fx: 2,
          fy: -1
        } );
      }
    );
  }
);

describe(
  "vectorCoordinatesText",
  () => {
    const point = {
      x: 0.25,
      y: 0.5
    };
    const valueSpace = {
      space: "value",
      min: 0,
      max: 1,
      decimals: 2
    };

    it(
      "prints a parameter-space point in its own units, or in canvas pixels",
      () => {
        expect( vectorCoordinatesText(
          point,
          {
            ...valueSpace,
            coordinates: "relative"
          },
          canvas
        ) ).toBe( "0.25, 0.50" );

        expect( vectorCoordinatesText(
          point,
          {
            ...valueSpace,
            coordinates: "absolute"
          },
          canvas
        ) ).toBe( "270, 675" );
      }
    );

    it(
      "prints a canvas-space point as pixels, or as a fraction of the canvas",
      () => {
        const mouse = {
          x: 270,
          y: 675
        };

        expect( vectorCoordinatesText(
          mouse,
          {
            space: "canvas",
            coordinates: "absolute"
          },
          canvas
        ) ).toBe( "270, 675" );

        expect( vectorCoordinatesText(
          mouse,
          {
            space: "canvas",
            coordinates: "relative",
            decimals: 2
          },
          canvas
        ) ).toBe( "0.25, 0.50" );
      }
    );

    it(
      "honours the decimals setting on the relative reading only",
      () => {
        expect( vectorCoordinatesText(
          {
            x: 1 / 3,
            y: 2 / 3
          },
          {
            ...valueSpace,
            coordinates: "relative",
            decimals: 3
          },
          canvas
        ) ).toBe( "0.333, 0.667" );
      }
    );

    it(
      "prints nothing when the readout is switched off",
      () => {
        expect( vectorCoordinatesText(
          point,
          {
            ...valueSpace,
            coordinates: "none"
          },
          canvas
        ) ).toBeNull();
      }
    );

    it(
      "describes the same dot in both modes",
      () => {
        const cfg = {
          ...valueSpace,
          coordinates: "absolute"
        };
        const {
          fx
        } = vectorFractions(
          point,
          cfg,
          canvas
        );

        // The absolute reading IS the fraction expressed in pixels: the plot
        // and the printed line can never disagree.
        expect( vectorCoordinatesText(
          point,
          cfg,
          canvas
        ) ).toBe( `${ Math.round( fx * canvas.width ) }, 675` );
      }
    );
  }
);
