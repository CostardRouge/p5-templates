/**
 * Tests for pointing a field at the control that was just moved.
 *
 * The form is a plain object behind get/set, so this exercises the real write
 * sequence without mounting react-hook-form.
 */
import type {
  FieldConfig
} from "../../components/ContentItems/constants/field-config";
import {
  applyLearnedChannel, armLearnForField, canLearnBindingFor
} from "../learnBindingForField";

jest.mock(
  "@/lib/channelBridge",
  () => ( {
    getMidiPortName: jest.fn( () => "" )
  } )
);

jest.mock(
  "@/lib/interactionBindings",
  () => ( {
    interactionBindingsEnabled: () => true
  } )
);

const {
  getMidiPortName
} = jest.requireMock( "@/lib/channelBridge" );

const MIDI_PORT = "Launchkey Mini MK3 MIDI Port";

const SLIDER = {
  component: "slider",
  min: 0,
  max: 10
} as unknown as FieldConfig;

function fakeForm( initial: Record<string, unknown> = {} ) {
  const store: Record<string, unknown> = {
    ...initial
  };

  return {
    store,
    getValues: ( path?: string ) => ( path === undefined ? store : store[ path ] ),
    setValue: (
      path: string, value: unknown
    ) => {
      store[ path ] = value;
    }
  };
}

describe(
  "canLearnBindingFor",
  () => {
    it(
      "offers the gesture on a bindable sketch parameter",
      () => {
        expect( canLearnBindingFor(
          "sketch.speed",
          SLIDER
        ) ).toBe( true );
      }
    );

    it(
      "refuses a path outside the sketch scope, like every binding affordance",
      () => {
        expect( canLearnBindingFor(
          "size.width",
          SLIDER
        ) ).toBe( false );
      }
    );

    it(
      "refuses a component nothing knows how to modulate",
      () => {
        expect( canLearnBindingFor(
          "sketch.caption",
          {
            component: "text"
          } as unknown as FieldConfig
        ) ).toBe( false );
      }
    );

    it(
      "refuses a 2D pad, which can arm but never capture",
      () => {
        // `observeForLearn` only ever returns a scalar channel.
        expect( canLearnBindingFor(
          "sketch.offset",
          {
            component: "vector2d"
          } as unknown as FieldConfig
        ) ).toBe( false );
      }
    );
  }
);

describe(
  "armLearnForField",
  () => {
    it(
      "switches MIDI on, so the handler requests access before anyone listens",
      async() => {
        const form = fakeForm();

        await armLearnForField(
          form.getValues,
          form.setValue,
          "sketch.speed"
        );

        // Without these the handler never calls requestMIDIAccess(), no CC is
        // ever published, and the learn has nothing to diff.
        expect( form.store[ "interactive.interaction.enabled" ] ).toBe( true );
        expect( form.store[ "interactive.interaction.midi.enabled" ] ).toBe( true );
        expect( form.store[ "interactive.interaction" ] ).toBeDefined();
      }
    );

    it(
      "writes into the sketch's own interaction block when it declares one",
      async() => {
        const form = fakeForm( {
          "sketch.interaction": {
            enabled: false
          }
        } );

        await armLearnForField(
          form.getValues,
          form.setValue,
          "sketch.speed"
        );

        expect( form.store[ "sketch.interaction.midi.enabled" ] ).toBe( true );
        expect( form.store[ "interactive.interaction" ] ).toBeUndefined();
      }
    );

    it(
      "does nothing for a path outside the sketch scope",
      async() => {
        const form = fakeForm();

        await armLearnForField(
          form.getValues,
          form.setValue,
          "size.width"
        );

        expect( Object.keys( form.store ) ).toHaveLength( 0 );
      }
    );
  }
);

describe(
  "applyLearnedChannel",
  () => {
    beforeEach( () => {
      getMidiPortName.mockReturnValue( "" );
    } );

    it(
      "stores the ABSTRACT control when the port is known",
      async() => {
        getMidiPortName.mockReturnValue( MIDI_PORT );

        const form = fakeForm();

        await applyLearnedChannel(
          form.getValues,
          form.setValue,
          "sketch.speed",
          SLIDER,
          "midi.cc80"
        );

        const [
          binding
        ] = form.store[ "interactive.bindings" ] as any[];

        // knob.3 is what survives a port switch; cc80 only names it on this port.
        expect( binding.control ).toBe( "knob.3" );
        expect( binding.target ).toBe( "speed" );
        expect( binding.kind ).toBe( "continuous" );
      }
    );

    it(
      "falls back to the raw channel when no controller map matches",
      async() => {
        const form = fakeForm();

        await applyLearnedChannel(
          form.getValues,
          form.setValue,
          "sketch.speed",
          SLIDER,
          "midi.cc80"
        );

        const [
          binding
        ] = form.store[ "interactive.bindings" ] as any[];

        expect( binding.control ).toBeUndefined();
        expect( binding.source ).toBe( "midi.cc80" );
      }
    );

    it(
      "replaces the source of an existing binding and keeps its mapping",
      async() => {
        getMidiPortName.mockReturnValue( MIDI_PORT );

        const form = fakeForm( {
          "interactive.bindings": [
            {
              id: "kept",
              target: "speed",
              kind: "continuous",
              source: "oscillator",
              mapping: {
                min: 2,
                max: 7,
                curve: "easeOutQuad"
              },
              smoothing: 0.4
            }
          ]
        } );

        await applyLearnedChannel(
          form.getValues,
          form.setValue,
          "sketch.speed",
          SLIDER,
          "midi.cc29"
        );

        const list = form.store[ "interactive.bindings" ] as any[];

        // The gesture means "drive this from another knob", not "start over".
        expect( list ).toHaveLength( 1 );
        expect( list[ 0 ].id ).toBe( "kept" );
        expect( list[ 0 ].control ).toBe( "knob.1" );
        expect( list[ 0 ].mapping ).toEqual( {
          min: 2,
          max: 7,
          curve: "easeOutQuad"
        } );
        expect( list[ 0 ].smoothing ).toBe( 0.4 );
      }
    );

    it(
      "leaves a binding on another target alone",
      async() => {
        getMidiPortName.mockReturnValue( MIDI_PORT );

        const form = fakeForm( {
          "interactive.bindings": [
            {
              id: "other",
              target: "radius",
              kind: "continuous",
              source: "oscillator"
            }
          ]
        } );

        await applyLearnedChannel(
          form.getValues,
          form.setValue,
          "sketch.speed",
          SLIDER,
          "midi.cc29"
        );

        const list = form.store[ "interactive.bindings" ] as any[];

        expect( list ).toHaveLength( 2 );
        expect( list[ 0 ].id ).toBe( "other" );
        expect( list[ 0 ].source ).toBe( "oscillator" );
      }
    );

    it(
      "switches MIDI on, or the binding would point at a channel nobody samples",
      async() => {
        getMidiPortName.mockReturnValue( MIDI_PORT );

        const form = fakeForm();

        await applyLearnedChannel(
          form.getValues,
          form.setValue,
          "sketch.speed",
          SLIDER,
          "midi.cc29"
        );

        expect( form.store[ "interactive.interaction.enabled" ] ).toBe( true );
        expect( form.store[ "interactive.interaction.midi.enabled" ] ).toBe( true );
        // The managed block has to be seeded before those flags mean anything.
        expect( form.store[ "interactive.interaction" ] ).toBeDefined();
      }
    );

    it(
      "does nothing for a path outside the sketch scope",
      async() => {
        const form = fakeForm();

        await applyLearnedChannel(
          form.getValues,
          form.setValue,
          "size.width",
          SLIDER,
          "midi.cc29"
        );

        expect( Object.keys( form.store ) ).toHaveLength( 0 );
      }
    );
  }
);
