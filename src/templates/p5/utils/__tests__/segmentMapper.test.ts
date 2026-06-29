import {
  mapProgressionToSegment
} from "@/p5/utils/slides/morph/segmentMapper.js";

describe(
  "mapProgressionToSegment",
  () => {
    test(
      "cyclic: divides the loop evenly and wraps last → first",
      () => {
        // n = 3, linear, no hold.
        expect( mapProgressionToSegment(
          0,
          3,
          {}
        ) ).toEqual( {
          fromIndex: 0,
          toIndex: 1,
          localT: 0
        } );

        const mid = mapProgressionToSegment(
          0.1,
          3,
          {}
        );

        expect( mid.fromIndex ).toBe( 0 );
        expect( mid.toIndex ).toBe( 1 );
        expect( mid.localT ).toBeCloseTo( 0.3 );

        const second = mapProgressionToSegment(
          1 / 3,
          3,
          {}
        );

        expect( second.fromIndex ).toBe( 1 );
        expect( second.toIndex ).toBe( 2 );

        // Last segment morphs back to the first slide.
        const wrap = mapProgressionToSegment(
          0.99,
          3,
          {}
        );

        expect( wrap.fromIndex ).toBe( 2 );
        expect( wrap.toIndex ).toBe( 0 );
        expect( wrap.localT ).toBeCloseTo( 0.97 );
      }
    );

    test(
      "cyclic n = 2 alternates 0 ↔ 1",
      () => {
        expect( mapProgressionToSegment(
          0.2,
          2,
          {}
        ).toIndex ).toBe( 1 );
        expect( mapProgressionToSegment(
          0.7,
          2,
          {}
        ).fromIndex ).toBe( 1 );
        expect( mapProgressionToSegment(
          0.7,
          2,
          {}
        ).toIndex ).toBe( 0 );
      }
    );

    test(
      "once: no wrap, holds the last source at the end",
      () => {
        // n = 3 → 2 segments.
        const a = mapProgressionToSegment(
          0.4,
          3,
          {
            loop: "once"
          }
        );

        expect( a.fromIndex ).toBe( 0 );
        expect( a.toIndex ).toBe( 1 );

        const end = mapProgressionToSegment(
          0.999,
          3,
          {
            loop: "once"
          }
        );

        expect( end.fromIndex ).toBe( 1 );
        expect( end.toIndex ).toBe( 2 ); // never wraps back to 0
        expect( end.localT ).toBeCloseTo(
          1,
          1
        );
      }
    );

    test(
      "pingpong: forward then reverse across the cycle",
      () => {
        // n = 3 → 4 segments: 0→1, 1→2, 2→1, 1→0.
        const segs = [
          0.1,
          0.35,
          0.6,
          0.85
        ].map( ( p ) =>
          mapProgressionToSegment(
            p,
            3,
            {
              loop: "pingpong"
            }
          ) );

        expect( segs.map( ( s ) => [
          s.fromIndex,
          s.toIndex
        ] ) ).toEqual( [
          [
            0,
            1
          ],
          [
            1,
            2
          ],
          [
            2,
            1
          ],
          [
            1,
            0
          ]
        ] );
      }
    );

    test(
      "holdRatio keeps localT at 0 during the hold, then remaps the morph",
      () => {
        // n = 2, holdRatio 0.5, linear. segP within segment 0 = p * 2.
        const held = mapProgressionToSegment(
          0.1,
          2,
          {
            holdRatio: 0.5
          }
        ); // segP 0.2

        expect( held.localT ).toBe( 0 );

        const morph = mapProgressionToSegment(
          0.45,
          2,
          {
            holdRatio: 0.5
          }
        ); // segP 0.9

        // (0.9 - 0.5) / (1 - 0.5) = 0.8
        expect( morph.localT ).toBeCloseTo( 0.8 );
      }
    );

    test(
      "applies the easing function, falling back to linear for unknown keys",
      () => {
        // n = 2, segP = 0.25 at p = 0.125.
        const eased = mapProgressionToSegment(
          0.125,
          2,
          {
            easing: "easeInOutCubic"
          }
        );

        // easeInOutCubic(0.25) = 4 * 0.25^3 = 0.0625
        expect( eased.localT ).toBeCloseTo( 0.0625 );

        const fallback = mapProgressionToSegment(
          0.125,
          2,
          {
            easing: "does-not-exist"
          }
        );

        expect( fallback.localT ).toBeCloseTo( 0.25 );
      }
    );

    test(
      "wraps monotonic recording progression back into one cycle",
      () => {
        const wrapped = mapProgressionToSegment(
          2.25,
          2,
          {}
        );
        const direct = mapProgressionToSegment(
          0.25,
          2,
          {}
        );

        expect( wrapped ).toEqual( direct );
      }
    );
  }
);
