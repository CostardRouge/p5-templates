/**
 * A blank kept thumbnail is one flat colour, JPEG noise aside.
 */

import {
  isUniformPixels
} from "../blankThumbnail";

const pixels = ( ...rgb: number[][] ) => rgb.flatMap( ( [
  r,
  g,
  b
] ) => [
  r,
  g,
  b,
  255
] );

describe(
  "isUniformPixels",
  () => {
    it(
      "calls a black frame with JPEG noise blank",
      () => {
        expect( isUniformPixels( pixels(
          [
            0,
            0,
            0
          ],
          [
            2,
            1,
            3
          ],
          [
            0,
            4,
            0
          ]
        ) ) ).toBe( true );
      }
    );

    it(
      "keeps a frame with a picture in it, even a dark one",
      () => {
        expect( isUniformPixels( pixels(
          [
            0,
            0,
            0
          ],
          [
            0,
            0,
            0
          ],
          [
            200,
            90,
            20
          ]
        ) ) ).toBe( false );
        expect( isUniformPixels( [] ) ).toBe( false );
      }
    );
  }
);
