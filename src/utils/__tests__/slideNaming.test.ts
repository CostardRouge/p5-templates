import {
  indexToLetters, makeCopyName, nextSlideLetter
} from "../slideNaming";

describe(
  "indexToLetters",
  () => {
    it(
      "labels the first 26 slides A–Z",
      () => {
        expect( indexToLetters( 0 ) ).toBe( "A" );
        expect( indexToLetters( 1 ) ).toBe( "B" );
        expect( indexToLetters( 25 ) ).toBe( "Z" );
      }
    );

    it(
      "rolls over to two letters like spreadsheet columns",
      () => {
        expect( indexToLetters( 26 ) ).toBe( "AA" );
        expect( indexToLetters( 27 ) ).toBe( "AB" );
        expect( indexToLetters( 51 ) ).toBe( "AZ" );
        expect( indexToLetters( 52 ) ).toBe( "BA" );
      }
    );

    it(
      "clamps invalid indices to A",
      () => {
        expect( indexToLetters( -5 ) ).toBe( "A" );
        expect( indexToLetters( 2.9 ) ).toBe( "C" );
      }
    );
  }
);

describe(
  "nextSlideLetter",
  () => {
    it(
      "starts at A for an empty deck",
      () => {
        expect( nextSlideLetter( [] ) ).toBe( "A" );
      }
    );

    it(
      "returns the next letter after a run of base slides",
      () => {
        expect( nextSlideLetter( [
          "A",
          "B",
          "C"
        ] ) ).toBe( "D" );
      }
    );

    it(
      "ignores numbered copies so they do not inflate the count",
      () => {
        expect( nextSlideLetter( [
          "A",
          "A-1",
          "B",
          "B-1",
          "B-2"
        ] ) ).toBe( "C" );
      }
    );

    it(
      "fills the lowest freed-up letter",
      () => {
        expect( nextSlideLetter( [
          "A",
          "C"
        ] ) ).toBe( "B" );
      }
    );

    it(
      "treats a base whose only slides are copies as free",
      () => {
        expect( nextSlideLetter( [
          "A",
          "A-1"
        ] ) ).toBe( "B" );
      }
    );
  }
);

describe(
  "makeCopyName",
  () => {
    it(
      "numbers the first copy of a base slide",
      () => {
        expect( makeCopyName(
          "A",
          [
            "A"
          ]
        ) ).toBe( "A-1" );
      }
    );

    it(
      "picks the next free number for further copies of the same base",
      () => {
        expect( makeCopyName(
          "A",
          [
            "A",
            "A-1"
          ]
        ) ).toBe( "A-2" );

        expect( makeCopyName(
          "A",
          [
            "A",
            "A-1",
            "A-2"
          ]
        ) ).toBe( "A-3" );
      }
    );

    it(
      "branches a copy-of-a-copy onto a merged base",
      () => {
        expect( makeCopyName(
          "A-12",
          [
            "A",
            "A-12"
          ]
        ) ).toBe( "A12-1" );

        expect( makeCopyName(
          "A-1",
          [
            "A",
            "A-1"
          ]
        ) ).toBe( "A1-1" );
      }
    );

    it(
      "keeps branched copies numbering independently",
      () => {
        expect( makeCopyName(
          "A-12",
          [
            "A",
            "A-12",
            "A12-1"
          ]
        ) ).toBe( "A12-2" );
      }
    );

    it(
      "trims surrounding whitespace before deriving the base",
      () => {
        expect( makeCopyName(
          "  B  ",
          [
            "B"
          ]
        ) ).toBe( "B-1" );
      }
    );
  }
);
