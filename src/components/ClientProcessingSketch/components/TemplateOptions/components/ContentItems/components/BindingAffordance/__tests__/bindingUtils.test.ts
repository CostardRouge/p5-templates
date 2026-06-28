import {
  channelSourceGroups,
  channelSourceOptions,
  interactionEnablePaths,
  sourceOptionShortLabel
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

describe(
  "channelSourceGroups",
  () => {
    it(
      "buckets every continuous option into its source family, losing none",
      () => {
        const groups = channelSourceGroups( "continuous" );
        const flat = channelSourceOptions( "continuous" );

        // No option is dropped and none is duplicated across groups.
        const grouped = groups.flatMap( ( g ) => g.options );

        expect( grouped ).toHaveLength( flat.length );
        expect( new Set( grouped.map( ( o ) => o.value ) ).size ).toBe( flat.length );

        // Every option in a group shares that group's family key.
        for ( const group of groups ) {
          for ( const option of group.options ) {
            expect( option.source.split( "." )[ 0 ] ).toBe( group.key );
          }
        }
      }
    );

    it(
      "gathers audio's vector projections AND its semantic scalars under one Audio group",
      () => {
        const groups = channelSourceGroups( "continuous" );
        const audio = groups.find( ( g ) => g.key === "audio" );

        expect( audio ).toBeDefined();
        expect( audio!.label ).toBe( "Audio" );
        // 4 vector projections (x/y/mag/angle) + 8 semantic scalars.
        expect( audio!.options ).toHaveLength( 12 );
        expect( audio!.options.some( ( o ) => o.source === "audio.bass" ) ).toBe( true );
        expect( audio!.options.some( ( o ) => o.source === "audio" && o.project === "x" ) ).toBe( true );
      }
    );

    it(
      "expands a vector2d family into its four projections",
      () => {
        const groups = channelSourceGroups( "continuous" );
        const mouse = groups.find( ( g ) => g.key === "mouse" );

        expect( mouse!.label ).toBe( "Mouse" );
        expect( mouse!.options.map( ( o ) => o.project ) ).toEqual( [
          "x",
          "y",
          "mag",
          "angle"
        ] );
      }
    );

    it(
      "gives each whole-channel vector2d source its own single-option group",
      () => {
        const groups = channelSourceGroups( "vector2d" );

        expect( groups.every( ( g ) => g.options.length === 1 ) ).toBe( true );
        expect( groups.map( ( g ) => g.key ) ).toContain( "mouse" );
        // Scalar-only families (audio.bass …) never appear for a vector target.
        expect( groups.some( ( g ) => g.key.includes( "." ) ) ).toBe( false );
      }
    );
  }
);

describe(
  "sourceOptionShortLabel",
  () => {
    it(
      "strips the family prefix when present",
      () => {
        expect( sourceOptionShortLabel( {
          value: "mouse::x",
          label: "Mouse · X",
          source: "mouse",
          project: "x",
          varName: ""
        } ) ).toBe( "X" );
        expect( sourceOptionShortLabel( {
          value: "audio.bass::",
          label: "Audio · Bass",
          source: "audio.bass",
          varName: ""
        } ) ).toBe( "Bass" );
      }
    );

    it(
      "keeps the full label when there is no projection suffix",
      () => {
        expect( sourceOptionShortLabel( {
          value: "mouse::",
          label: "Mouse",
          source: "mouse",
          varName: ""
        } ) ).toBe( "Mouse" );
      }
    );
  }
);
