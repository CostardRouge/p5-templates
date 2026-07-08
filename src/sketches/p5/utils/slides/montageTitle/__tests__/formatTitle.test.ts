import formatSlideTitleImpl, {
  formatTitleCore as formatTitleCoreImpl,
  shortenSlideId as shortenSlideIdImpl,
  toAlphabet as toAlphabetImpl
} from "@/p5/utils/slides/montageTitle/formatTitle.js";

// The utils are untyped JS; give them call signatures for the assertions below.
const formatSlideTitle = formatSlideTitleImpl as (
  subject: any,
  position: number,
  deckIndex: number,
  title?: Record<string, unknown>
) => string;
const formatTitleCore = formatTitleCoreImpl as typeof formatSlideTitle;
const shortenSlideId = shortenSlideIdImpl as (
  id: unknown,
  length?: number
) => string;
const toAlphabet = toAlphabetImpl as (
  index: number,
  uppercase?: boolean
) => string;

describe(
  "toAlphabet",
  () => {
    test(
      "maps indices to a bijective base-26 sequence",
      () => {
        expect( toAlphabet( 0 ) ).toBe( "A" );
        expect( toAlphabet( 25 ) ).toBe( "Z" );
        expect( toAlphabet( 26 ) ).toBe( "AA" );
        expect( toAlphabet( 27 ) ).toBe( "AB" );
      }
    );

    test(
      "lower-cases when asked and clamps invalid indices to A",
      () => {
        expect( toAlphabet(
          1,
          false
        ) ).toBe( "b" );
        expect( toAlphabet( -5 ) ).toBe( "A" );
        expect( toAlphabet( NaN ) ).toBe( "A" );
      }
    );
  }
);

describe(
  "shortenSlideId",
  () => {
    test(
      "keeps the trailing alphanumerics after dropping the slide_ prefix",
      () => {
        expect( shortenSlideId(
          "slide_2f8c91a0-b3d4-4e5f-9a1b-c0ffee123456",
          6
        ) ).toBe( "123456" );
      }
    );

    test(
      "is resilient to short ids and non-strings",
      () => {
        expect( shortenSlideId(
          "slide_ab",
          6
        ) ).toBe( "ab" );
        expect( shortenSlideId( undefined ) ).toBe( "" );
        expect( shortenSlideId( 42 as unknown as string ) ).toBe( "" );
      }
    );
  }
);

describe(
  "formatTitleCore",
  () => {
    test(
      "number mode honours start and padding by source position",
      () => {
        expect( formatTitleCore(
          {},
          0,
          0,
          {
            mode: "number",
            numberStart: 1
          }
        ) ).toBe( "1" );
        expect( formatTitleCore(
          {},
          2,
          0,
          {
            mode: "number",
            numberStart: 1,
            numberPadding: 3
          }
        ) ).toBe( "003" );
      }
    );

    test(
      "name mode falls back to the deck position and respects uppercase",
      () => {
        expect( formatTitleCore(
          {
            name: "Hero"
          },
          0,
          0,
          {
            mode: "name"
          }
        ) ).toBe( "HERO" );
        expect( formatTitleCore(
          {
            name: "Hero"
          },
          0,
          0,
          {
            mode: "name",
            uppercase: false
          }
        ) ).toBe( "Hero" );
        expect( formatTitleCore(
          {},
          1,
          4,
          {
            mode: "name"
          }
        ) ).toBe( "SLIDE 5" );
      }
    );

    test(
      "alphabet mode indexes by source position",
      () => {
        expect( formatTitleCore(
          {},
          2,
          0,
          {
            mode: "alphabet"
          }
        ) ).toBe( "C" );
      }
    );

    test(
      "id mode shortens the durable id",
      () => {
        expect( formatTitleCore(
          {
            id: "slide_aaaa1111bbbb2222"
          },
          0,
          0,
          {
            mode: "id",
            idLength: 4
          }
        ) ).toBe( "2222" );
      }
    );
  }
);

describe(
  "formatSlideTitle",
  () => {
    test(
      "prepends the prefix when enabled",
      () => {
        expect( formatSlideTitle(
          {},
          2,
          0,
          {
            mode: "number",
            numberStart: 1,
            showPrefix: true,
            prefix: "variante"
          }
        ) ).toBe( "variante 3" );
      }
    );

    test(
      "omits the prefix when disabled or blank",
      () => {
        expect( formatSlideTitle(
          {},
          0,
          0,
          {
            mode: "alphabet",
            showPrefix: false,
            prefix: "variante"
          }
        ) ).toBe( "A" );
        expect( formatSlideTitle(
          {},
          0,
          0,
          {
            mode: "alphabet",
            showPrefix: true,
            prefix: "   "
          }
        ) ).toBe( "A" );
      }
    );

    test(
      "honours an overridden prefix word",
      () => {
        expect( formatSlideTitle(
          {},
          1,
          0,
          {
            mode: "number",
            numberStart: 1,
            showPrefix: true,
            prefix: "version"
          }
        ) ).toBe( "version 2" );
      }
    );
  }
);
