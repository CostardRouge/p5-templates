/**
 * The «Post #» and «Category #» pills count his sends kept by this browser.
 */

import {
  sendNumbers
} from "../counters";
import type {
  Publication
} from "../publishStore";

const send = (
  key: string, target: Publication[ "target" ] = "schedule"
) => ( {
  key,
  publication: {
    postIds: [
      "p"
    ],
    channelIds: [
      "ig"
    ],
    kind: "reel",
    variantName: "Reel",
    files: 1,
    at: null,
    target,
    sentAt: 0
  } as Publication
} );

describe(
  "a send's numbers",
  () => {
    it(
      "counts his sends, then his sends of this category, drafts aside",
      () => {
        const kept = [
          send( "p5/iridescent-v1-sphere" ),
          send( "p5/iridescent-v2-tunnel" ),
          send( "p5/voronoi-v1-cells" ),
          send(
            "p5/iridescent-v3-cylinder",
            "draft"
          )
        ];
        const categoryOf = ( key: string ) => key.split( "/" )[ 1 ].split( "-" )[ 0 ];

        expect( sendNumbers(
          kept,
          categoryOf,
          "iridescent"
        ) ).toEqual( {
          postNo: 4,
          catNo: 3
        } );
        expect( sendNumbers(
          [],
          categoryOf,
          null
        ) ).toEqual( {
          postNo: 1,
          catNo: null
        } );
      }
    );
  }
);
