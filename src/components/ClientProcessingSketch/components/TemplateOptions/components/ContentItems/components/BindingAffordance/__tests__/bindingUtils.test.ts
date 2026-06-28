import {
  interactionEnablePaths
} from "../bindingUtils";

describe(
  "interactionEnablePaths",
  () => {
    it(
      "enables the vision parent and the tracker for camera sources",
      () => {
        expect( interactionEnablePaths( "hands" ) ).toEqual( [
          "enabled",
          "vision.enabled",
          "vision.hands.enabled"
        ] );
        expect( interactionEnablePaths( "fingers" ) ).toEqual( [
          "enabled",
          "vision.enabled",
          "vision.fingers.enabled"
        ] );
        expect( interactionEnablePaths( "face" ) ).toEqual( [
          "enabled",
          "vision.enabled",
          "vision.face.enabled"
        ] );
        expect( interactionEnablePaths( "body" ) ).toEqual( [
          "enabled",
          "vision.enabled",
          "vision.body.enabled"
        ] );
      }
    );

    it(
      "enables the mic AND the named-bands feature for semantic audio scalars",
      () => {
        const expected = [
          "enabled",
          "audio.enabled",
          "audio.features.bands"
        ];

        expect( interactionEnablePaths( "audio.level" ) ).toEqual( expected );
        expect( interactionEnablePaths( "audio.bass" ) ).toEqual( expected );
        expect( interactionEnablePaths( "audio.treble" ) ).toEqual( expected );
      }
    );

    it(
      "enables only the mic for the whole-audio vector source",
      () => {
        expect( interactionEnablePaths( "audio" ) ).toEqual( [
          "enabled",
          "audio.enabled"
        ] );
      }
    );

    it(
      "enables the source's own flag for simple input sources",
      () => {
        expect( interactionEnablePaths( "mouse" ) ).toEqual( [
          "enabled",
          "mouse.enabled"
        ] );
        expect( interactionEnablePaths( "touch" ) ).toEqual( [
          "enabled",
          "touch.enabled"
        ] );
        expect( interactionEnablePaths( "orbit" ) ).toEqual( [
          "enabled",
          "orbit.enabled"
        ] );
        expect( interactionEnablePaths( "perlinNoise" ) ).toEqual( [
          "enabled",
          "perlinNoise.enabled"
        ] );
        expect( interactionEnablePaths( "gyroscope" ) ).toEqual( [
          "enabled",
          "gyroscope.enabled"
        ] );
        expect( interactionEnablePaths( "midi" ) ).toEqual( [
          "enabled",
          "midi.enabled"
        ] );
        expect( interactionEnablePaths( "joypad" ) ).toEqual( [
          "enabled",
          "joypad.enabled"
        ] );
      }
    );

    it(
      "returns nothing for generators and unknown sources",
      () => {
        expect( interactionEnablePaths( "oscillator" ) ).toEqual( [] );
        expect( interactionEnablePaths( "ramp" ) ).toEqual( [] );
        expect( interactionEnablePaths( "sequence" ) ).toEqual( [] );
        expect( interactionEnablePaths( "noise" ) ).toEqual( [] );
        expect( interactionEnablePaths( "random" ) ).toEqual( [] );
        expect( interactionEnablePaths( "whatever" ) ).toEqual( [] );
      }
    );
  }
);
