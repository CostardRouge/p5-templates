import {
  RealtimeRecorder
} from "./strategies/RealtimeRecorder";
import {
  AsyncLoopRecorder
} from "./strategies/AsyncLoopRecorder";
import {
  createGifEncoderFactory
} from "./encoders/GifEncoder";
import {
  createMediabunnyEncoderFactory
} from "./encoders/MediabunnyEncoder";
import {
  getAudioBridge
} from "@/lib/audioBridge";
import type {
  Recorder,
  RecorderHost,
  RecordingFormat,
  RecordingMode
} from "./types";

const DEFAULT_AUDIO_SAMPLE_RATE = 48_000;
const DEFAULT_AUDIO_CHANNELS = 1;

export type CreateRecorderOptions = {
  host: RecorderHost;
  format: RecordingFormat;
  mode: RecordingMode;
  /**
   * Mux the sketch's audio when a bridge is registered. Defaults to `true`.
   *
   * Set `false` for a capture that stitches several slides into one clip: the
   * audio engine logs events against the sketch's *deterministic* time, which
   * restarts at zero on every slide, so a single offline render would stack
   * every slide's audio on top of the first slide's span.
   */
  audio?: boolean;
};

/**
 * Build a recorder bound to a host with the chosen mode + format.
 *
 * Constraints:
 *   - `gif` only supports `async-loop` mode (MediaRecorder can't emit GIF).
 *     Passing `mode: "realtime"` with `format: "gif"` throws.
 *   - `webm` works in both modes; realtime uses MediaRecorder, async-loop
 *     uses mediabunny + WebCodecs.
 *   - `mp4` works in both modes too; realtime relies on browser MP4
 *     support (Safari + recent Chromium), async-loop uses WebCodecs.
 */
export function createRecorder( opts: CreateRecorderOptions ): Recorder {
  const {
    host, format, mode, audio = true
  } = opts;

  if ( format === "gif" && mode !== "async-loop" ) {
    throw new Error( "createRecorder: gif format requires async-loop mode." );
  }

  if ( mode === "realtime" ) {
    return new RealtimeRecorder(
      host,
      format
    );
  }

  // gif reads the image source handed to `addFrame` each tick, so it needs
  // no canvas up-front. The WebCodecs (mediabunny) encoder binds to the
  // stream canvas once and re-reads it per frame — for DOM engines that's
  // the mirror canvas that `source.readFrame()` repaints before each add.
  let factory;

  if ( format === "gif" ) {
    factory = createGifEncoderFactory();
  } else {
    const canvas = host.getCaptureSource().getStreamCanvas();

    if ( !canvas ) {
      throw new Error( "createRecorder: capture source has no stream canvas." );
    }

    // If a sketch audio engine has registered a bridge, wire an audio
    // track into the encoder so the recorder can mux the offline-rendered
    // buffer once the frame loop ends. Video-only sketches register no
    // bridge — no audio track is added and the output is identical to
    // before.
    const audioOpts = audio && getAudioBridge()
      ? {
        sampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
        numberOfChannels: DEFAULT_AUDIO_CHANNELS
      }
      : undefined;

    factory = createMediabunnyEncoderFactory(
      format,
      canvas,
      audioOpts
    );
  }

  return new AsyncLoopRecorder(
    host,
    format,
    factory
  );
}
