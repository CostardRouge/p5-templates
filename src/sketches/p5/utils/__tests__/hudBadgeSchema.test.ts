import {
  HudBadgeItemSchema, BADGE_SEGMENTS
} from "@/types/sketch.types";

describe(
  "HUD badge element schema",
  () => {
    it(
      "defaults to the sketch identity segments, enabled, no override",
      () => {
        const badge = HudBadgeItemSchema.parse( {
          type: "hud-badge"
        } );

        // Standalone elements default to enabled: a layer added from the
        // palette must show up (the legacy container slot defaulted off).
        expect( badge.enabled ).toBe( true );
        expect( badge.segments ).toEqual( [
          "engine",
          "category",
          "name"
        ] );
        expect( badge.override ).toBe( "" );
      }
    );

    it(
      "carries its own full style with the old container defaults",
      () => {
        const badge = HudBadgeItemSchema.parse( {
          type: "hud-badge"
        } );

        expect( badge.fill ).toEqual( [
          0,
          255,
          120,
          255
        ] );
        expect( badge.font ).toBe( "spaceMonoRegular" );
        expect( badge.blend ).toBe( "source-over" );
        expect( badge.backgroundColor ).toEqual( [
          0,
          0,
          0,
          0
        ] );
      }
    );

    it(
      "keeps a user-picked order and preserves duplicates",
      () => {
        const badge = HudBadgeItemSchema.parse( {
          type: "hud-badge",
          segments: [
            "name",
            "fps",
            "resolution-fps",
            "fps"
          ]
        } );

        expect( badge.segments ).toEqual( [
          "name",
          "fps",
          "resolution-fps",
          "fps"
        ] );
      }
    );

    it(
      "heals a stale/unknown token instead of throwing",
      () => {
        const badge = HudBadgeItemSchema.parse( {
          type: "hud-badge",
          segments: [
            "engine",
            "bogus",
            "name"
          ]
        } );

        expect( badge.segments ).toEqual( [
          "engine",
          "name",
          "name"
        ] );
      }
    );

    it(
      "exposes every token in BADGE_SEGMENTS",
      () => {
        expect( BADGE_SEGMENTS ).toEqual( [
          "resolution",
          "fps",
          "resolution-fps",
          "engine",
          "category",
          "name"
        ] );
      }
    );
  }
);
