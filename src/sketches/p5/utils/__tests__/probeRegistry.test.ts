/**
 * The probe registry's contract, driven with a fake instance key and a
 * hand-advanced frame: a write is readable in its own frame and the next, a
 * name written N times folds instead of keeping the last particle, and two
 * instances of one module never see each other's slots.
 */

import {
  createProbeRegistry, probeShape
} from "../probeRegistry.js";

describe(
  "createProbeRegistry",
  () => {
    it(
      "hands the value back so the call drops into an expression",
      () => {
        const registry = createProbeRegistry();

        registry.beginFrame();

        expect( registry.write(
          "head",
          3.25
        ) ).toBe( 3.25 );
        expect( registry.read( "head" ) ).toBe( 3.25 );
      }
    );

    it(
      "keeps a probe live for one frame after its last write, then drops it",
      () => {
        const registry = createProbeRegistry();

        registry.beginFrame();
        registry.write(
          "head",
          1
        );

        registry.beginFrame();
        expect( registry.read( "head" ) ).toBe( 1 );

        registry.beginFrame();
        expect( registry.read( "head" ) ).toBeUndefined();
        expect( registry.snapshot() ).toEqual( [] );
      }
    );

    it(
      "counts the writes of a frame and resets the count on the next one",
      () => {
        const registry = createProbeRegistry();

        registry.beginFrame();

        for ( let i = 0; i < 5; i++ ) {
          registry.write(
            "r",
            i
          );
        }

        expect( registry.snapshot()[ 0 ] ).toMatchObject( {
          name: "r",
          value: 4,
          count: 5,
          fold: "last"
        } );

        registry.beginFrame();
        registry.write(
          "r",
          9
        );

        expect( registry.snapshot()[ 0 ] ).toMatchObject( {
          value: 9,
          count: 1
        } );
      }
    );

    it(
      "folds a name written many times into min / max / mean / sum / count",
      () => {
        const registry = createProbeRegistry();
        const values = [
          2,
          8,
          5
        ];

        for ( const mode of [
          "min",
          "max",
          "mean",
          "sum",
          "count"
        ] ) {
          registry.beginFrame();

          for ( const value of values ) {
            registry.fold(
              "r",
              value,
              mode
            );
          }

          expect( registry.read( "r" ) ).toBe( {
            min: 2,
            max: 8,
            mean: 5,
            sum: 15,
            count: 3
          }[ mode ] );
        }
      }
    );

    it(
      "folds a non-numeric value as last, and an unknown mode as last",
      () => {
        const registry = createProbeRegistry();

        registry.beginFrame();
        registry.fold(
          "mode",
          "air",
          "mean"
        );
        registry.fold(
          "mode",
          "ice",
          "mean"
        );
        expect( registry.read( "mode" ) ).toBe( "ice" );

        registry.fold(
          "n",
          1,
          "median"
        );
        registry.fold(
          "n",
          2,
          "median"
        );
        expect( registry.read( "n" ) ).toBe( 2 );
      }
    );

    it(
      "keeps the first meta it is given and publishes it with the entry",
      () => {
        const registry = createProbeRegistry();

        registry.beginFrame();
        registry.write(
          "arc.height",
          0.5,
          {
            label: "Arc",
            unit: "u",
            min: -2,
            max: 2
          }
        );
        registry.write(
          "arc.height",
          0.6,
          {
            label: "Other"
          }
        );

        expect( registry.meta( "arc.height" ) ).toEqual( {
          label: "Arc",
          unit: "u",
          min: -2,
          max: 2
        } );
        expect( registry.snapshot()[ 0 ] ).toMatchObject( {
          label: "Arc",
          unit: "u",
          min: -2,
          max: 2,
          decimals: null
        } );
      }
    );

    it(
      "publishes live probes in first-written order, with their shape",
      () => {
        const registry = createProbeRegistry();

        registry.beginFrame();
        registry.write(
          "head",
          1
        );
        registry.write(
          "pos",
          {
            x: 1,
            y: 2
          }
        );
        registry.write(
          "submerged",
          true
        );
        registry.write(
          "view",
          "orbit"
        );

        expect( registry.snapshot().map( ( entry ) => [
          entry.name,
          entry.shape
        ] ) ).toEqual( [
          [
            "head",
            "scalar"
          ],
          [
            "pos",
            "point"
          ],
          [
            "submerged",
            "boolean"
          ],
          [
            "view",
            "text"
          ]
        ] );
      }
    );

    it(
      "keeps a layer's probes out of the page's, and reads only the page",
      () => {
        let key: object | null = null;
        const registry = createProbeRegistry( {
          getKey: () => key
        } );
        const layer = {};

        registry.beginFrame();
        registry.write(
          "head",
          1
        );

        key = layer;
        registry.write(
          "head",
          99
        );
        registry.write(
          "layerOnly",
          7
        );
        key = null;

        expect( registry.read( "head" ) ).toBe( 1 );
        expect( registry.read( "layerOnly" ) ).toBeUndefined();
        expect( registry.snapshot().map( ( entry ) => entry.name ) ).toEqual( [
          "head"
        ] );
      }
    );

    it(
      "forgets everything on reset",
      () => {
        const registry = createProbeRegistry();

        registry.beginFrame();
        registry.write(
          "head",
          1
        );
        registry.reset();

        expect( registry.frame ).toBe( 0 );
        expect( registry.read( "head" ) ).toBeUndefined();
        expect( registry.snapshot() ).toEqual( [] );
      }
    );
  }
);

describe(
  "probeShape",
  () => {
    it(
      "sorts values the way the pickers do",
      () => {
        expect( probeShape( 1 ) ).toBe( "scalar" );
        expect( probeShape( true ) ).toBe( "boolean" );
        expect( probeShape( "orbit" ) ).toBe( "text" );
        expect( probeShape( {
          x: 0,
          y: 0
        } ) ).toBe( "point" );
        expect( probeShape( [
          255,
          0,
          0
        ] ) ).toBe( "list" );
        expect( probeShape( undefined ) ).toBe( "other" );
      }
    );
  }
);
