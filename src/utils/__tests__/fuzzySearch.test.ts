import {
  fuzzyMatch, fuzzyFilter
} from "../fuzzySearch";

describe(
  "fuzzyMatch",
  () => {
    it(
      "should match exact strings",
      () => {
        const result = fuzzyMatch(
          "photo",
          "photo"
        );

        expect( result ).not.toBeNull();
        expect( result?.score ).toBeGreaterThan( 0 );
      }
    );

    it(
      "should match partial strings",
      () => {
        const result = fuzzyMatch(
          "pho",
          "photo-in-circle"
        );

        expect( result ).not.toBeNull();
        expect( result?.score ).toBeGreaterThan( 0 );
      }
    );

    it(
      "should match multiple words in different positions",
      () => {
        const result = fuzzyMatch(
          "pho circle",
          "photo-in-circle"
        );

        expect( result ).not.toBeNull();
        expect( result?.score ).toBeGreaterThan( 0 );
      }
    );

    it(
      "should match with word boundaries",
      () => {
        const result = fuzzyMatch(
          "text morph",
          "text-morphing-depth"
        );

        expect( result ).not.toBeNull();
        expect( result?.score ).toBeGreaterThan( 0 );
      }
    );

    it(
      "should not match when characters are missing",
      () => {
        const result = fuzzyMatch(
          "xyz",
          "photo-in-circle"
        );

        expect( result ).toBeNull();
      }
    );

    it(
      "should handle empty search",
      () => {
        const result = fuzzyMatch(
          "",
          "photo-in-circle"
        );

        expect( result ).not.toBeNull();
        expect( result?.score ).toBe( 0 );
      }
    );

    it(
      "should be case insensitive",
      () => {
        const result = fuzzyMatch(
          "PHO CIRCLE",
          "photo-in-circle"
        );

        expect( result ).not.toBeNull();
        expect( result?.score ).toBeGreaterThan( 0 );
      }
    );
  }
);

describe(
  "fuzzyFilter",
  () => {
    const items = [
      {
        name: "photo-in-circle",
        category: "photo"
      },
      {
        name: "photo-grid",
        category: "photo"
      },
      {
        name: "text-morphing",
        category: "text"
      },
      {
        name: "photo-dice",
        category: "photo"
      }
    ];

    it(
      "should filter items based on fuzzy search",
      () => {
        const result = fuzzyFilter(
          items,
          "pho circle",
          ( item ) => item.name
        );

        expect( result ).toHaveLength( 1 );
        expect( result[ 0 ].name ).toBe( "photo-in-circle" );
      }
    );

    it(
      "should return all items when search is empty",
      () => {
        const result = fuzzyFilter(
          items,
          "",
          ( item ) => item.name
        );

        expect( result ).toHaveLength( items.length );
      }
    );

    it(
      "should search in multiple fields",
      () => {
        const result = fuzzyFilter(
          items,
          "pho",
          ( item ) => [
            item.name,
            item.category
          ]
        );

        expect( result.length ).toBeGreaterThan( 0 );
        expect( result.every( ( item ) => item.category === "photo" ) ).toBe( true );
      }
    );

    it(
      "should sort by relevance score",
      () => {
        const result = fuzzyFilter(
          items,
          "photo",
          ( item ) => item.name
        );

        // Items with "photo" at the start should score higher
        expect( result[ 0 ].name ).toContain( "photo" );
      }
    );
  }
);
