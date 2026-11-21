import {
  ensureVariants
} from "../../export/variantStore";
import {
  getDraft, patchDraft, resetPublishStore
} from "../../postiz/publishStore";
import {
  CAROUSEL_NAME, routeBeat
} from "../beatVariant";

describe(
  "routeBeat",
  () => {
    beforeEach( resetPublishStore );

    it(
      "gives the variations a stills-of-every-slide variant, once, and every account takes it",
      () => {
        const key = "p5/route-a";
        const id = routeBeat(
          key,
          true,
          [
            "ig",
            "x"
          ]
        )!;
        const made = ensureVariants( key ).variants.find( ( v ) => v.id === id )!;

        expect( made ).toMatchObject( {
          name: CAROUSEL_NAME,
          kind: "image",
          slides: "all"
        } );
        expect( getDraft( key ) ).toMatchObject( {
          variantId: id,
          variantFor: {
            ig: id,
            x: id
          }
        } );
        expect( routeBeat(
          key,
          true,
          [
            "ig"
          ]
        ) ).toBe( id );
        expect( ensureVariants( key ).variants.filter( ( v ) => v.slides === "all" ) ).toHaveLength( 1 );
      }
    );

    it(
      "takes the carousel back for any other beat, and leaves his own picks alone",
      () => {
        const key = "p5/route-b";
        const own = ensureVariants( key ).variants[ 0 ].id;

        patchDraft(
          key,
          {
            variantFor: {
              tiktok: own
            }
          }
        );
        routeBeat(
          key,
          true,
          [
            "ig"
          ]
        );
        routeBeat(
          key,
          false,
          [
            "ig"
          ]
        );
        expect( getDraft( key ).variantId ).toBeNull();
        expect( getDraft( key ).variantFor ).toEqual( {
          tiktok: own
        } );
        // A sketch that never had a carousel is not touched at all.
        expect( routeBeat(
          "p5/route-c",
          false,
          []
        ) ).toBeNull();
      }
    );
  }
);
