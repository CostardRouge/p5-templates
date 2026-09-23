/**
 * @jest-environment jsdom
 */

/**
 * The probe list re-renders when a probe appears or disappears — and not on
 * the snapshot that lands every frame with the same names.
 */
import {
  act, renderHook
} from "@testing-library/react";
import {
  publishProbes, type ProbeEntry
} from "@/lib/probeBridge";
import {
  useLiveProbes
} from "../useLiveProbes";

function entry(
  name: string, value: number
): ProbeEntry {
  return {
    name,
    value,
    shape: "scalar",
    count: 1,
    fold: "last",
    label: null,
    unit: null,
    min: null,
    max: null,
    decimals: null
  };
}

function publish( snapshot: ProbeEntry[] ) {
  act( () => {
    publishProbes( snapshot );
  } );
}

describe(
  "useLiveProbes",
  () => {
    beforeEach( () => {
      publishProbes( [] );
    } );

    it(
      "lists the probes the engine is publishing, without their values",
      () => {
        publishProbes( [
          entry(
            "head",
            1
          )
        ] );

        const {
          result
        } = renderHook( () => useLiveProbes() );

        expect( result.current ).toEqual( [
          {
            name: "head",
            shape: "scalar",
            label: null,
            unit: null,
            fold: "last"
          }
        ] );
      }
    );

    it(
      "keeps the same list object while only values change frame to frame",
      () => {
        publishProbes( [
          entry(
            "head",
            1
          )
        ] );

        const {
          result
        } = renderHook( () => useLiveProbes() );
        const first = result.current;

        publish( [
          entry(
            "head",
            2
          )
        ] );
        publish( [
          entry(
            "head",
            3
          )
        ] );

        expect( result.current ).toBe( first );
      }
    );

    it(
      "re-renders when a probe appears, and when one disappears",
      () => {
        const {
          result
        } = renderHook( () => useLiveProbes() );

        expect( result.current ).toEqual( [] );

        publish( [
          entry(
            "head",
            1
          ),
          entry(
            "arc.t",
            0.5
          )
        ] );

        expect( result.current.map( ( probe ) => probe.name ) ).toEqual( [
          "head",
          "arc.t"
        ] );

        publish( [
          entry(
            "head",
            1
          )
        ] );

        expect( result.current.map( ( probe ) => probe.name ) ).toEqual( [
          "head"
        ] );
      }
    );
  }
);
