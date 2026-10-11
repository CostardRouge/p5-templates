import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  bindableTargets, bindingCommands
} from "../commands/bindingCommands";
import {
  fakeHandles
} from "./fakeHandles";

function setup(
  document: Record<string, any>, enabled: true | string = true
) {
  const fake = fakeHandles(
    document,
    enabled === true ? {} : {
      bindings: {
        ...fakeHandles( {} ).handles.bindings,
        enabled: () => enabled
      }
    }
  );
  const registry = createCommandRegistry();

  registry.register( bindingCommands( fake.handles ) );

  return {
    ...fake,
    registry
  };
}

describe(
  "binding commands",
  () => {
    it(
      "list the bindable controls with their kind and the sources each kind takes",
      async() => {
        const {
          registry, handles
        } = setup( {
          sketch: {}
        } );

        expect( bindableTargets( handles ) ).toEqual( [
          {
            target: "render.hueSpeed",
            kind: "continuous",
            component: "slider"
          },
          {
            target: "render.palette",
            kind: "enum",
            component: "select"
          }
        ] );
        const result = await registry.execute( "bindings.targets" ) as Record<string, any>;

        expect( result.sources.continuous.map( ( s: { source: string } ) => s.source ) ).toEqual( [
          "mouse",
          "audio.bass",
          "oscillator",
          "ramp"
        ] );
        expect( result.sources.enum.map( ( s: { source: string } ) => s.source ) ).toEqual( [
          "mouse",
          "audio.bass",
          "oscillator",
          "ramp"
        ] );
      }
    );

    it(
      "are unavailable when the build has no bindings",
      async() => {
        const {
          registry
        } = setup(
          {
            sketch: {}
          },
          "off in this build"
        );

        await expect( registry.execute( "bindings.list" ) ).rejects.toMatchObject( {
          code: "unavailable",
          message: "off in this build"
        } );
      }
    );

    it(
      "add a binding with the editor's defaults, then the source and fields over them, through the one write path",
      async() => {
        const {
          registry, document, calls, setActive
        } = setup( {
          sketch: {},
          slides: [
            {
              sketch: {}
            }
          ]
        } );

        expect( await registry.execute(
          "bindings.add",
          {
            target: "render.hueSpeed",
            fields: {
              mapping: {
                min: 1,
                max: 2,
                curve: "easeInOutSine"
              },
              smoothing: 0
            }
          }
        ) ).toEqual( {
          scope: "the root",
          index: 0,
          binding: {
            id: "b-render.hueSpeed",
            source: "oscillator",
            target: "render.hueSpeed",
            kind: "continuous",
            oscillator: {
              wave: "sine",
              cycles: 1,
              phase: 0
            },
            mapping: {
              min: 1,
              max: 2,
              curve: "easeInOutSine"
            },
            smoothing: 0,
            enabled: true,
            weight: 1,
            blend: "replace"
          }
        } );
        expect( document.interactive.bindings ).toHaveLength( 1 );
        expect( calls ).toEqual( [
          "bindings interactive 1 enable oscillator"
        ] );

        // A live channel on a slide, with its projection.
        setActive( 0 );
        const added = await registry.execute(
          "bindings.add",
          {
            target: "render.hueSpeed",
            source: "mouse",
            project: "x"
          }
        ) as Record<string, any>;

        expect( added.scope ).toBe( "slide 0" );
        expect( added.binding ).toMatchObject( {
          source: "mouse",
          project: "x"
        } );
        expect( document.slides[ 0 ].interactive.bindings ).toHaveLength( 1 );
        expect( calls.at( -1 ) ).toBe( "bindings slides.0.interactive 1 enable mouse" );
        expect( await registry.execute( "bindings.list" ) ).toMatchObject( {
          scope: "slide 0",
          count: 1,
          bindings: [
            {
              index: 0,
              target: "render.hueSpeed",
              source: "mouse"
            }
          ]
        } );
      }
    );

    it(
      "refuse an unbindable target, a source the kind cannot take, and a field the binding has not",
      async() => {
        const {
          registry
        } = setup( {
          sketch: {}
        } );

        await expect( registry.execute(
          "bindings.add",
          {
            target: "render.hue"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "\"render.hue\" is not a bindable parameter — did you mean render.hueSpeed?"
        } );
        // A vector channel on a scalar target needs its projection; an unknown
        // generator is refused naming what the picker offers.
        await expect( registry.execute(
          "bindings.add",
          {
            target: "render.palette",
            source: "mouse"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: "source \"mouse\" cannot drive a enum target — one of: mouse (project x), audio.bass, oscillator, ramp"
        } );
        await expect( registry.execute(
          "bindings.add",
          {
            target: "render.hueSpeed",
            source: "noise"
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: expect.stringContaining( "source \"noise\" cannot drive a continuous target" )
        } );
        await expect( registry.execute(
          "bindings.add",
          {
            target: "render.hueSpeed",
            fields: {
              min: 1
            }
          }
        ) ).rejects.toMatchObject( {
          code: "invalid",
          message: expect.stringContaining( "unknown binding field \"min\"" )
        } );
        await expect( registry.execute(
          "bindings.add",
          {
            target: "render.hueSpeed",
            fields: {
              blend: "screen"
            }
          }
        ) ).rejects.toMatchObject( {
          message: "blend \"screen\" — one of replace, add, multiply, max, min, average"
        } );
        await expect( registry.execute(
          "bindings.update",
          {
            index: 0,
            fields: {}
          }
        ) ).rejects.toMatchObject( {
          message: "the root has no bindings — bindings.add makes one"
        } );
      }
    );

    it(
      "update seeds a newly picked generator's block and enables a new source; remove shifts the rest down",
      async() => {
        const {
          registry, document, calls
        } = setup( {
          sketch: {},
          interactive: {
            bindings: [
              {
                id: "a",
                source: "oscillator",
                target: "render.hueSpeed",
                kind: "continuous",
                oscillator: {
                  wave: "sine"
                },
                mapping: {
                  min: 0,
                  max: 3
                },
                enabled: true
              },
              {
                id: "b",
                source: "oscillator",
                target: "render.palette",
                kind: "enum",
                enabled: true
              }
            ]
          }
        } );

        const updated = await registry.execute(
          "bindings.update",
          {
            index: 0,
            fields: {
              source: "ramp",
              weight: 0.5
            }
          }
        ) as Record<string, any>;

        expect( updated.binding ).toMatchObject( {
          id: "a",
          source: "ramp",
          weight: 0.5,
          ramp: {
            easing: "linear",
            count: 1
          }
        } );
        expect( calls.at( -1 ) ).toBe( "bindings interactive 2 enable ramp" );
        // Only the fields given change; the second binding is untouched.
        expect( document.interactive.bindings[ 1 ].id ).toBe( "b" );

        await registry.execute(
          "bindings.update",
          {
            index: 1,
            fields: {
              enabled: false
            }
          }
        );
        expect( calls.at( -1 ) ).toBe( "bindings interactive 2" );
        expect( document.interactive.bindings[ 1 ].enabled ).toBe( false );

        expect( await registry.execute(
          "bindings.remove",
          {
            index: 0
          }
        ) ).toMatchObject( {
          removed: {
            id: "a"
          },
          remaining: 1
        } );
        expect( document.interactive.bindings.map( ( b: { id: string } ) => b.id ) ).toEqual( [
          "b"
        ] );
        await expect( registry.execute(
          "bindings.remove",
          {
            index: 1
          }
        ) ).rejects.toMatchObject( {
          message: "no binding 1 on the root — bindings 0 to 0 (bindings.list)"
        } );
      }
    );
  }
);
