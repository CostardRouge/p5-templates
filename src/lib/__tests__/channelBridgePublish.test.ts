/**
 * @jest-environment jsdom
 *
 * The bridge's CSS-var side: a channel present in one snapshot and absent
 * from the next must take its `--ch-*` vars with it, or a device that stopped
 * publishing (the absence rule in interaction/channels.js) reads as a frozen
 * meter instead of an empty one.
 */
import {
  publishChannels
} from "../channelBridge";

const read = ( name: string ) => document.documentElement.style.getPropertyValue( name );

describe(
  "publishChannels",
  () => {
    it(
      "writes a vector2d channel's four projections and a scalar's one var",
      () => {
        publishChannels( {
          gyroscope: {
            type: "vector2d",
            x: 0.75,
            y: 0.25
          },
          "audio.level": {
            type: "scalar",
            value: 0.4
          }
        } );

        expect( read( "--ch-gyroscope-x" ) ).toBe( "0.75" );
        expect( read( "--ch-gyroscope-y" ) ).toBe( "0.25" );
        expect( read( "--ch-gyroscope-mag" ) ).not.toBe( "" );
        expect( read( "--ch-gyroscope-angle" ) ).not.toBe( "" );
        expect( read( "--ch-audio-level" ) ).toBe( "0.4" );
      }
    );

    it(
      "removes the vars of a channel that stopped publishing, and only those",
      () => {
        publishChannels( {
          gyroscope: {
            type: "vector2d",
            x: 0.75,
            y: 0.25
          },
          "audio.level": {
            type: "scalar",
            value: 0.4
          }
        } );
        publishChannels( {
          "audio.level": {
            type: "scalar",
            value: 0.6
          }
        } );

        for ( const suffix of [
          "-x",
          "-y",
          "-mag",
          "-angle"
        ] ) {
          expect( read( `--ch-gyroscope${ suffix }` ) ).toBe( "" );
        }

        expect( read( "--ch-audio-level" ) ).toBe( "0.6" );
      }
    );
  }
);
