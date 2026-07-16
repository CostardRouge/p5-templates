/**
 * Covers the breakdown's text formatting helpers.
 */

import {
  formatCounter,
  formatValue,
  humanizeKey,
  looksLikeColor,
  looksLikeVector,
  nearlyEqual
} from "../format.js";

describe(
  "humanizeKey",
  () => {
    it(
      "splits camelCase and separators into upper-case words",
      () => {
        expect( humanizeKey( "strokeWeight" ) ).toBe( "STROKE WEIGHT" );
        expect( humanizeKey( "noise_detail-x" ) ).toBe( "NOISE DETAIL X" );
        expect( humanizeKey( "grid.columns" ) ).toBe( "GRID COLUMNS" );
      }
    );
  }
);

describe(
  "formatValue",
  () => {
    it(
      "formats scalars",
      () => {
        expect( formatValue( 3 ) ).toBe( "3" );
        expect( formatValue( 0.256 ) ).toBe( "0.26" );
        expect( formatValue( true ) ).toBe( "on" );
        expect( formatValue( false ) ).toBe( "off" );
        expect( formatValue( "smooth" ) ).toBe( "smooth" );
      }
    );

    it(
      "formats colors, vectors and opaque arrays",
      () => {
        expect( formatValue( [
          255,
          0,
          0
        ] ) ).toBe( "rgba(255, 0, 0)" );
        expect( formatValue( [
          0.5,
          0.25
        ] ) ).toBe( "(0.5, 0.25)" );
        expect( formatValue( [
          1,
          "a",
          true
        ] ) ).toBe( "[3]" );
      }
    );

    it(
      "returns null for values the overlay never narrates",
      () => {
        expect( formatValue( null ) ).toBeNull();
        expect( formatValue( undefined ) ).toBeNull();
        expect( formatValue( () => 1 ) ).toBeNull();
        expect( formatValue( {
          nested: true
        } ) ).toBeNull();
      }
    );
  }
);

describe(
  "formatCounter",
  () => {
    it(
      "renders numeric counters as index/total",
      () => {
        expect( formatCounter(
          0,
          3,
          "numeric"
        ) ).toBe( "1/3" );
        expect( formatCounter(
          2,
          3
        ) ).toBe( "3/3" );
      }
    );

    it(
      "renders spreadsheet-style letters",
      () => {
        expect( formatCounter(
          0,
          3,
          "letters"
        ) ).toBe( "A" );
        expect( formatCounter(
          25,
          99,
          "letters"
        ) ).toBe( "Z" );
        expect( formatCounter(
          26,
          99,
          "letters"
        ) ).toBe( "AA" );
        expect( formatCounter(
          27,
          99,
          "letters"
        ) ).toBe( "AB" );
      }
    );
  }
);

describe(
  "nearlyEqual",
  () => {
    it(
      "compares with a relative epsilon",
      () => {
        expect( nearlyEqual(
          1,
          1 + 1e-9
        ) ).toBe( true );
        expect( nearlyEqual(
          1000000,
          1000000.5
        ) ).toBe( true );
        expect( nearlyEqual(
          0.1,
          0.2
        ) ).toBe( false );
        expect( nearlyEqual(
          0,
          0
        ) ).toBe( true );
      }
    );
  }
);

describe(
  "shape guards",
  () => {
    it(
      "detects color- and vector-shaped arrays",
      () => {
        expect( looksLikeColor( [
          0,
          0,
          0,
          255
        ] ) ).toBe( true );
        expect( looksLikeColor( [
          0,
          0
        ] ) ).toBe( false );
        expect( looksLikeVector( [
          0,
          0
        ] ) ).toBe( true );
        expect( looksLikeVector( [
          0,
          0,
          0
        ] ) ).toBe( false );
      }
    );
  }
);
