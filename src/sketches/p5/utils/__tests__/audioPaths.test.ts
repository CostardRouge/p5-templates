import {
  collectAudioPaths, isAudioPath
} from "@/p5/utils/audioPaths.js";

describe(
  "isAudioPath",
  () => {
    it.each( [
      "global/audios/click.wav",
      "slide-2/audios/mouse-down.mp3",
      "/assets/audio/pop.ogg",
      "sample.M4A",
      "beep.flac?v=2",
      "hit.opus#frag"
    ] )(
      "accepts %s",
      ( value ) => {
        expect( isAudioPath( value ) ).toBe( true );
      }
    );

    it.each( [
      "",
      "global/images/photo.png",
      // Video containers belong to the videos kind — never to a sound field.
      "global/videos/clip.mp4",
      "global/videos/clip.webm",
      "click",
      "wav"
    ] )(
      "rejects %s",
      ( value ) => {
        expect( isAudioPath( value ) ).toBe( false );
      }
    );

    it(
      "rejects non-strings",
      () => {
        expect( isAudioPath( undefined ) ).toBe( false );
        expect( isAudioPath( null ) ).toBe( false );
        expect( isAudioPath( 42 ) ).toBe( false );
      }
    );
  }
);

describe(
  "collectAudioPaths",
  () => {
    it(
      "walks nested objects and arrays, de-duplicating",
      () => {
        const paths = collectAudioPaths( {
          enabled: true,
          down: "global/audios/down.wav",
          up: "global/audios/up.wav",
          nested: {
            again: "global/audios/down.wav",
            list: [
              "global/audios/tail.mp3",
              "global/images/cursor.png",
              null
            ]
          }
        } );

        expect( paths ).toEqual( [
          "global/audios/down.wav",
          "global/audios/up.wav",
          "global/audios/tail.mp3"
        ] );
      }
    );

    it(
      "returns an empty list for sound-free options",
      () => {
        expect( collectAudioPaths( {
          scale: 1,
          images: {
            pointing: "/assets/images/cursors/handpointing.png"
          }
        } ) ).toEqual( [] );
      }
    );
  }
);
