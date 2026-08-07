import {
  diffDrags
} from "@/p5/utils/interaction/dragMath.js";

const map = ( entries: Array<[string, number]> ) => new Map( entries );

describe(
  "diffDrags",
  () => {
    it(
      "reports nothing when the held handles are unchanged",
      () => {
        const held = map( [
          [
            "mouse",
            3
          ],
          [
            "vp-0",
            7
          ]
        ] );

        expect( diffDrags(
          held,
          map( [
            [
              "mouse",
              3
            ],
            [
              "vp-0",
              7
            ]
          ] )
        ) ).toEqual( {
          downs: [],
          ups: []
        } );
      }
    );

    it(
      "reports a down when a pointer takes a handle",
      () => {
        expect( diffDrags(
          map( [] ),
          map( [
            [
              "mouse",
              2
            ]
          ] )
        ) ).toEqual( {
          downs: [
            {
              key: "mouse",
              index: 2
            }
          ],
          ups: []
        } );
      }
    );

    it(
      "reports an up when a pointer lets go",
      () => {
        expect( diffDrags(
          map( [
            [
              "vp-1",
              5
            ]
          ] ),
          map( [] )
        ) ).toEqual( {
          downs: [],
          ups: [
            {
              key: "vp-1",
              index: 5
            }
          ]
        } );
      }
    );

    it(
      "reports both edges when a pointer swaps handles in one frame",
      () => {
        expect( diffDrags(
          map( [
            [
              "mouse",
              1
            ]
          ] ),
          map( [
            [
              "mouse",
              4
            ]
          ] )
        ) ).toEqual( {
          downs: [
            {
              key: "mouse",
              index: 4
            }
          ],
          ups: [
            {
              key: "mouse",
              index: 1
            }
          ]
        } );
      }
    );

    it(
      "handles a whole troupe grabbing and releasing at once",
      () => {
        const before = map( [
          [
            "vp-0",
            0
          ],
          [
            "vp-1",
            1
          ]
        ] );
        const after = map( [
          [
            "vp-1",
            1
          ],
          [
            "vp-2",
            2
          ]
        ] );
        const {
          downs,
          ups
        } = diffDrags(
          before,
          after
        );

        expect( downs ).toEqual( [
          {
            key: "vp-2",
            index: 2
          }
        ] );
        expect( ups ).toEqual( [
          {
            key: "vp-0",
            index: 0
          }
        ] );
      }
    );
  }
);
