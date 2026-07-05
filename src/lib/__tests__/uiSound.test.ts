/**
 * @jest-environment jsdom
 */

/**
 * The editor UI-sound module must click only for genuine user edits. A sketch
 * pushes its options back into the form when it opens, which reaches
 * `playValueChange` as a named — but programmatic — value change; that must
 * stay silent. These tests pin the two gates that guarantee it.
 */

const scheduleClick = jest.fn();

jest.mock(
  "@/lib/clickSynth",
  () => ( {
    CLICK_PRESET_NAMES: [
      "click"
    ],
    scheduleClick: ( ...args: unknown[] ) => scheduleClick( ...args )
  } )
);

type UiSoundModule = typeof import( "../uiSound" );

/** Fresh module instance so gesture/suppression state never leaks between tests. */
async function loadModule(): Promise<UiSoundModule> {
  let mod!: UiSoundModule;

  await jest.isolateModulesAsync( async() => {
    mod = await import( "../uiSound" );
  } );

  return mod;
}

function stubAudioContext(): void {
  class FakeParam {
    value = 0;
    setValueAtTime = jest.fn();
    linearRampToValueAtTime = jest.fn();
    exponentialRampToValueAtTime = jest.fn();
  }

  class FakeGain {
    gain = new FakeParam();
    connect = jest.fn();
  }

  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    createGain = () => new FakeGain();
    resume = jest.fn().mockResolvedValue( undefined );
  }

  ( window as unknown as {
    AudioContext: unknown;
  } ).AudioContext = FakeAudioContext;
}

beforeEach( () => {
  scheduleClick.mockClear();
  stubAudioContext();
  window.localStorage.clear();
} );

describe(
  "playValueChange gating",
  () => {
    it(
      "stays silent for a programmatic change with no preceding user gesture",
      async() => {
        const mod = await loadModule();

        mod.setUiSoundSettings( {
          enabled: true
        } );

        mod.playValueChange( "sketch.magnitude" );

        expect( scheduleClick ).not.toHaveBeenCalled();
      }
    );

    it(
      "clicks when a real pointer gesture just happened",
      async() => {
        const mod = await loadModule();

        mod.setUiSoundSettings( {
          enabled: true
        } );

        // A held pointer keeps a slider drag "live".
        window.dispatchEvent( new Event( "pointerdown" ) );

        mod.playValueChange( "sketch.magnitude" );

        expect( scheduleClick ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "stays silent while a programmatic batch is suppressed, even mid-gesture",
      async() => {
        const mod = await loadModule();

        mod.setUiSoundSettings( {
          enabled: true
        } );
        window.dispatchEvent( new Event( "pointerdown" ) );

        mod.withUiSoundSuppressed( () => mod.playValueChange( "sketch.magnitude" ) );

        expect( scheduleClick ).not.toHaveBeenCalled();
      }
    );

    it(
      "never clicks while the feature is disabled",
      async() => {
        const mod = await loadModule();

        window.dispatchEvent( new Event( "pointerdown" ) );
        mod.playValueChange( "sketch.magnitude" );

        expect( scheduleClick ).not.toHaveBeenCalled();
      }
    );

    it(
      "stays silent for non-sketch fields even during a real gesture",
      async() => {
        const mod = await loadModule();

        mod.setUiSoundSettings( {
          enabled: true
        } );
        window.dispatchEvent( new Event( "pointerdown" ) );

        // Content items, slide-level content and general settings never click.
        mod.playValueChange( "content.0.text" );
        mod.playValueChange( "slides.1.content.2.hud.badge.enabled" );
        mod.playValueChange( "slides.0.transition.enabled" );
        mod.playValueChange( "size.width" );
        mod.playValueChange( "animation.duration" );

        expect( scheduleClick ).not.toHaveBeenCalled();
      }
    );

    it(
      "clicks for global and per-slide sketch parameters",
      async() => {
        const mod = await loadModule();

        mod.setUiSoundSettings( {
          enabled: true,
          minGapMs: 0
        } );
        window.dispatchEvent( new Event( "pointerdown" ) );

        mod.playValueChange( "sketch.magnitude" );
        mod.playValueChange( "slides.2.sketch.colors.0" );

        expect( scheduleClick ).toHaveBeenCalledTimes( 2 );
      }
    );
  }
);

describe(
  "isSoundFeedbackField",
  () => {
    it(
      "matches only sketch-settings paths",
      async() => {
        const mod = await loadModule();

        expect( mod.isSoundFeedbackField( "sketch" ) ).toBe( true );
        expect( mod.isSoundFeedbackField( "sketch.magnitude" ) ).toBe( true );
        expect( mod.isSoundFeedbackField( "slides.0.sketch" ) ).toBe( true );
        expect( mod.isSoundFeedbackField( "slides.12.sketch.colors.0" ) ).toBe( true );

        expect( mod.isSoundFeedbackField( "content.0.text" ) ).toBe( false );
        expect( mod.isSoundFeedbackField( "slides.0.content.1.type" ) ).toBe( false );
        expect( mod.isSoundFeedbackField( "slides.0.transition.enabled" ) ).toBe( false );
        expect( mod.isSoundFeedbackField( "size.width" ) ).toBe( false );
        expect( mod.isSoundFeedbackField( "animation.duration" ) ).toBe( false );
        // A field that merely contains "sketch" further down must not match.
        expect( mod.isSoundFeedbackField( "content.0.sketch" ) ).toBe( false );
      }
    );
  }
);
