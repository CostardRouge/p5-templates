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
import type {
  Recorder,
  RecorderHost,
  RecordingFormat,
  RecordingMode
} from "./types";

export type CreateRecorderOptions = {
  host: RecorderHost;
  format: RecordingFormat;
  mode: RecordingMode;
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
    host, format, mode
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

  const canvas = host.getCanvas();

  if ( !canvas ) {
    throw new Error( "createRecorder: host has no canvas." );
  }

  const factory =
    format === "gif"
      ? createGifEncoderFactory()
      : createMediabunnyEncoderFactory(
        format,
        canvas
      );

  return new AsyncLoopRecorder(
    host,
    format,
    factory
  );
}
