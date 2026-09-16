import {
  channelSourceGroups,
  channelSourceOptions,
  describeChannel,
  interactionEnablePaths,
  LEARN_THRESHOLD,
  observeForLearn,
  sourceOptionShortLabel,
  withSelectedSource
} from "../bindingUtils";

const scalar = ( value: number ) => ( {
  type: "scalar" as const,
  value
} );

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
      "enables the MIDI source for a control-change scalar",
      () => {
        expect( interactionEnablePaths( "midi.cc1" ) ).toEqual( [
          "enabled",
          "midi.enabled"
        ] );
        expect( interactionEnablePaths( "midi.ccLast" ) ).toEqual( [
          "enabled",
          "midi.enabled"
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
      "offers MIDI's note projections and the learn channel, but no guessed CC",
      () => {
        const groups = channelSourceGroups( "continuous" );
        const midi = groups.find( ( g ) => g.key === "midi" );

        expect( midi ).toBeDefined();
        expect( midi!.label ).toBe( "MIDI" );
        // 4 vector projections (x/y/mag/angle) + the learn channel. A per-CC
        // option only exists once that CC has actually arrived.
        expect( midi!.options ).toHaveLength( 5 );
        expect( midi!.options.some( ( o ) => o.source === "midi.ccLast" ) ).toBe( true );
        expect( midi!.options.some( ( o ) => /^midi\.cc\d+$/.test( o.source ) ) ).toBe( false );
      }
    );

    it(
      "drops live channels into the family group the manifest already opened",
      () => {
        const groups = channelSourceGroups(
          "continuous",
          [
            "midi.cc113",
            "midi.cc29",
            "midi.cc9"
          ]
        );
        const midi = groups.find( ( g ) => g.key === "midi" );

        // No second "midi" group, and the CCs sort numerically rather than as
        // strings ("midi.cc113" < "midi.cc29" alphabetically).
        expect( groups.filter( ( g ) => g.key === "midi" ) ).toHaveLength( 1 );
        expect( midi!.options.slice( -3 ).map( ( o ) => o.source ) ).toEqual( [
          "midi.cc9",
          "midi.cc29",
          "midi.cc113"
        ] );
        expect( midi!.options.slice( -3 ).map( ( o ) => o.label ) ).toEqual( [
          "MIDI · CC 9",
          "MIDI · CC 29",
          "MIDI · CC 113"
        ] );
      }
    );

    it(
      "never offers a live channel to a vector2d target",
      () => {
        const groups = channelSourceGroups(
          "vector2d",
          [
            "midi.cc29"
          ]
        );

        expect( groups.some( ( g ) => g.options.some( ( o ) => o.source === "midi.cc29" ) ) ).toBe( false );
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

describe(
  "describeChannel",
  () => {
    it(
      "prefers the manifest, then derives a label for a runtime id",
      () => {
        expect( describeChannel( "audio.bass" ).label ).toBe( "Audio · Bass" );
        expect( describeChannel( "midi.cc29" ) ).toEqual( {
          id: "midi.cc29",
          type: "scalar",
          label: "MIDI · CC 29"
        } );
        // An unknown family still reads as a channel rather than as an id.
        expect( describeChannel( "joypad.trigger" ).label ).toBe( "Joypad · Left stick · trigger" );
        expect( describeChannel( "whatever" ).label ).toBe( "whatever" );
      }
    );
  }
);

describe(
  "withSelectedSource",
  () => {
    const groups = () => channelSourceGroups( "continuous" );

    it(
      "leaves the groups alone when the source is already offered",
      () => {
        const base = groups();

        expect( withSelectedSource(
          base,
          "audio.bass",
          undefined
        ) ).toBe( base );
        expect( withSelectedSource(
          base,
          "mouse",
          "x"
        ) ).toBe( base );
      }
    );

    it(
      "adds the binding's own source when it is not arriving",
      () => {
        // The reload case: CC 29 is saved on the binding but the knob has not
        // been touched yet, so no live channel carries it.
        const midi = withSelectedSource(
          groups(),
          "midi.cc29",
          undefined
        ).find( ( g ) => g.key === "midi" );
        const option = midi!.options[ midi!.options.length - 1 ];

        expect( option.value ).toBe( "midi.cc29::" );
        expect( option.label ).toBe( "MIDI · CC 29 (not arriving)" );
      }
    );

    it(
      "keeps the projection on a vector2d source, and ignores generators",
      () => {
        const wild = withSelectedSource(
          groups(),
          "tilt.pad",
          "mag"
        ).find( ( g ) => g.key === "tilt" );

        expect( wild!.options[ 0 ].value ).toBe( "tilt.pad::mag" );
        expect( wild!.options[ 0 ].label ).toBe( "tilt · pad · Magnitude (not arriving)" );

        const base = groups();

        expect( withSelectedSource(
          base,
          "oscillator",
          undefined
        ) ).toBe( base );
      }
    );
  }
);

describe(
  "observeForLearn",
  () => {
    it(
      "names nothing on the first snapshot, however far from zero a channel sits",
      () => {
        const references = new Map<string, number>();

        // Seeding pass: a knob already parked at 0.9 is not "moving".
        expect( observeForLearn(
          {
            "midi.cc29": scalar( 0.9 ),
            "audio.level": scalar( 0.4 )
          },
          references
        ) ).toBeNull();
        expect( references.get( "midi.cc29" ) ).toBe( 0.9 );
      }
    );

    it(
      "names a channel once it travels past the threshold, in either direction",
      () => {
        const references = new Map<string, number>();

        observeForLearn(
          {
            "midi.cc29": scalar( 0.5 )
          },
          references
        );

        // A nudge inside the threshold is a pot's jitter, not a gesture.
        expect( observeForLearn(
          {
            "midi.cc29": scalar( 0.5 + LEARN_THRESHOLD / 2 )
          },
          references
        ) ).toBeNull();

        expect( observeForLearn(
          {
            "midi.cc29": scalar( 0.9 )
          },
          references
        ) ).toBe( "midi.cc29" );
        expect( observeForLearn(
          {
            "midi.cc29": scalar( 0.1 )
          },
          references
        ) ).toBe( "midi.cc29" );
      }
    );

    it(
      "learns a channel that did not exist when arming",
      () => {
        const references = new Map<string, number>();

        // The MIDI case: cc113 has no arm-time value at all — it appears with
        // the knob's first message, which seeds it, and the rest of the turn
        // is measured from there.
        observeForLearn(
          {
            "midi.cc29": scalar( 0.5 )
          },
          references
        );

        expect( observeForLearn(
          {
            "midi.cc29": scalar( 0.5 ),
            "midi.cc113": scalar( 0.2 )
          },
          references
        ) ).toBeNull();
        expect( observeForLearn(
          {
            "midi.cc29": scalar( 0.5 ),
            "midi.cc113": scalar( 0.8 )
          },
          references
        ) ).toBe( "midi.cc113" );
      }
    );

    it(
      "names the control, never a channel that merely mirrors it",
      () => {
        const references = new Map<string, number>();

        // midi.ccLast follows whichever CC moved last, so after cc108 it sits
        // high; turning cc79 drags it all the way down and it moves FURTHER
        // than the freshly-seeded knob does. It must still lose.
        observeForLearn(
          {
            "midi.cc108": scalar( 0.87 ),
            "midi.ccLast": scalar( 0.87 )
          },
          references
        );
        observeForLearn(
          {
            "midi.cc108": scalar( 0.87 ),
            "midi.cc79": scalar( 0.08 ),
            "midi.ccLast": scalar( 0.08 )
          },
          references
        );

        expect( observeForLearn(
          {
            "midi.cc108": scalar( 0.87 ),
            "midi.cc79": scalar( 0.94 ),
            "midi.ccLast": scalar( 0.94 )
          },
          references
        ) ).toBe( "midi.cc79" );
      }
    );

    it(
      "ignores an aggregate channel too",
      () => {
        const references = new Map<string, number>();

        // audio.level is the mean of the bands, so it moves with all of them.
        observeForLearn(
          {
            "audio.level": scalar( 0 ),
            "audio.bass": scalar( 0 )
          },
          references
        );

        expect( observeForLearn(
          {
            "audio.level": scalar( 0.9 ),
            "audio.bass": scalar( 0.8 )
          },
          references
        ) ).toBe( "audio.bass" );
      }
    );

    it(
      "picks the largest mover and ignores vector2d channels",
      () => {
        const references = new Map<string, number>();
        const first = {
          "midi.cc29": scalar( 0 ),
          "midi.cc79": scalar( 0 ),
          mouse: {
            type: "vector2d" as const,
            x: 0,
            y: 0
          }
        };

        observeForLearn(
          first,
          references
        );

        expect( observeForLearn(
          {
            "midi.cc29": scalar( 0.3 ),
            "midi.cc79": scalar( 0.7 ),
            mouse: {
              type: "vector2d" as const,
              x: 1,
              y: 1
            }
          },
          references
        ) ).toBe( "midi.cc79" );
      }
    );

    it(
      "survives an empty or malformed snapshot",
      () => {
        const references = new Map<string, number>();

        expect( observeForLearn(
          {},
          references
        ) ).toBeNull();
        expect( observeForLearn(
          undefined as any,
          references
        ) ).toBeNull();
        expect( observeForLearn(
          {
            "midi.cc29": scalar( Number.NaN )
          },
          references
        ) ).toBeNull();
        expect( references.has( "midi.cc29" ) ).toBe( false );
      }
    );
  }
);
