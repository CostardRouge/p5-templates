import {
  HudBadgeSchema, HudItemSchema, BADGE_SEGMENTS
} from "@/types/sketch.types";

describe(
  "HUD badge revamp",
  () => {
    it(
      "defaults to the sketch identity segments, off, no override",
      () => {
        const badge = HudBadgeSchema.parse( {} );

        expect( badge.enabled ).toBe( false );
        expect( badge.segments ).toEqual( [
          "engine",
          "category",
          "name"
        ] );
        expect( badge.override ).toBe( "" );
      }
    );

    it(
      "is reachable through a fresh HUD item",
      () => {
        const hud = HudItemSchema.parse( {
          type: "hud"
        } );

        expect( hud.badge.segments ).toEqual( [
          "engine",
          "category",
          "name"
        ] );
      }
    );

    it(
      "keeps a user-picked order and preserves duplicates",
      () => {
        const badge = HudBadgeSchema.parse( {
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
        const badge = HudBadgeSchema.parse( {
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
