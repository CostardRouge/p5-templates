/**
 * Guards CSS-var naming for channel ids — dotted/structured ids (e.g.
 * "audio.level", later "audio.band.0") must become valid custom-property idents.
 */
import {
  channelVarName, bindingSignalVarName
} from "../channelBridge";

describe(
  "channelVarName",
  () => {
    it(
      "keeps a plain source id",
      () => {
        expect( channelVarName( "mouse" ) ).toBe( "--ch-mouse" );
      }
    );

    it(
      "appends a projection",
      () => {
        expect( channelVarName(
          "mouse",
          "x"
        ) ).toBe( "--ch-mouse-x" );
      }
    );

    it(
      "sanitizes dotted semantic ids into a valid custom property",
      () => {
        expect( channelVarName( "audio.level" ) ).toBe( "--ch-audio-level" );
        expect( channelVarName( "audio.band.0" ) ).toBe( "--ch-audio-band-0" );
      }
    );
  }
);

describe(
  "bindingSignalVarName",
  () => {
    it(
      "sanitizes a dotted target path",
      () => {
        expect( bindingSignalVarName( "ring.radius" ) ).toBe( "--bind-ring-radius" );
      }
    );
  }
);
