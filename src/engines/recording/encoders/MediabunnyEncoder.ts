import {
  Output,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  Mp4OutputFormat,
  WebMOutputFormat,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec
} from "mediabunny";
import type {
  FrameEncoder,
  FrameEncoderFactory,
  RecordingFormat
} from "../types";

const WEBM_CODEC_CANDIDATES = [
  "vp9",
  "vp8"
] as const;

const MP4_CODEC_CANDIDATES = [
  "avc"
] as const;

// Default per container — kept aligned with what each muxer accepts.
const WEBM_AUDIO_CODEC_CANDIDATES = [
  "opus"
] as const;
const MP4_AUDIO_CODEC_CANDIDATES = [
  "aac"
] as const;

export type MediabunnyAudioOptions = {
  sampleRate: number;
  numberOfChannels: number;
  bitrate?: number;
};

async function pickCodec(
  format: RecordingFormat, width: number, height: number
) {
  const candidates =
    format === "mp4" ? MP4_CODEC_CANDIDATES : WEBM_CODEC_CANDIDATES;

  const codec = await getFirstEncodableVideoCodec(
    candidates as unknown as Parameters<typeof getFirstEncodableVideoCodec>[ 0 ],
    {
      width,
      height
    }
  );

  if ( !codec ) {
    throw new Error( `No supported ${ format } video codec on this browser (WebCodecs missing or codec unavailable).` );
  }

  return codec;
}

async function pickAudioCodec(
  format: RecordingFormat,
  numberOfChannels: number,
  sampleRate: number
) {
  const candidates =
    format === "mp4"
      ? MP4_AUDIO_CODEC_CANDIDATES
      : WEBM_AUDIO_CODEC_CANDIDATES;

  return getFirstEncodableAudioCodec(
    candidates as unknown as Parameters<typeof getFirstEncodableAudioCodec>[ 0 ],
    {
      numberOfChannels,
      sampleRate
    }
  );
}

/**
 * Mediabunny-backed encoder for webm + mp4. Uses WebCodecs under the
 * hood via `CanvasSource` — requires Chrome 94+, Edge 94+, Safari 16.4+.
 */
class MediabunnyEncoder implements FrameEncoder {
  readonly mimeType: string;
  readonly fileExtension: string;
  /** True if an audio track was added at init time. */
  readonly hasAudioTrack: boolean;

  private output: Output | null = null;
  private source: CanvasSource | null = null;
  private audioSource: AudioBufferSource | null = null;
  private frameIndex = 0;
  private frameDuration: number;
  private initPromise: Promise<void>;

  constructor(
    public readonly format: RecordingFormat,
    private canvas: HTMLCanvasElement,
    private params: {
      width: number;
      height: number;
      frameRate: number;
      videoBitsPerSecond?: number;
      audio?: MediabunnyAudioOptions;
    }
  ) {
    this.mimeType = format === "mp4" ? "video/mp4" : "video/webm";
    this.fileExtension = format === "mp4" ? "mp4" : "webm";
    this.hasAudioTrack = Boolean( params.audio );
    this.frameDuration = 1 / this.params.frameRate;
    this.initPromise = this.initOutput();
  }

  private async initOutput(): Promise<void> {
    const codec = await pickCodec(
      this.format,
      this.params.width,
      this.params.height
    );
    const outputFormat =
      this.format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat();

    this.output = new Output( {
      format: outputFormat,
      target: new BufferTarget()
    } );

    this.source = new CanvasSource(
      this.canvas,
      {
        codec,
        bitrate: this.params.videoBitsPerSecond ?? 8_000_000,
        // Lock encoder dimensions to the first frame's box. Without this,
        // a mid-recording canvas resize would force mediabunny to rebuild
        // the avc1 codec string (the level field depends on resolution),
        // which the muxer rejects with "codec description is not supposed
        // to change during the entire recording".
        sizeChangeBehavior: "contain"
      }
    );

    this.output.addVideoTrack( this.source );

    if ( this.params.audio ) {
      const audioCodec = await pickAudioCodec(
        this.format,
        this.params.audio.numberOfChannels,
        this.params.audio.sampleRate
      );

      // If the browser can't encode the requested container's audio codec
      // we keep going video-only rather than failing the recording —
      // mediabunny rejects empty audio tracks at finalize.
      if ( audioCodec ) {
        this.audioSource = new AudioBufferSource( {
          codec: audioCodec,
          bitrate: this.params.audio.bitrate ?? 128_000
        } );
        this.output.addAudioTrack( this.audioSource );
      } else {
        ( this as { hasAudioTrack: boolean } ).hasAudioTrack = false;
      }
    }

    await this.output.start();
  }

  async addAudioBuffer( buffer: AudioBuffer ): Promise<void> {
    await this.initPromise;

    if ( !this.audioSource ) {
      return;
    }

    await this.audioSource.add( buffer );
  }

  async addFrame( _source: CanvasImageSource ): Promise<void> {
    await this.initPromise;

    if ( !this.source ) {
      throw new Error( "MediabunnyEncoder: source not initialised." );
    }

    const timestamp = this.frameIndex * this.frameDuration;

    await this.source.add(
      timestamp,
      this.frameDuration
    );

    this.frameIndex++;
  }

  async finalize(): Promise<Blob> {
    await this.initPromise;

    if ( !this.output ) {
      throw new Error( "MediabunnyEncoder: output not initialised." );
    }

    await this.output.finalize();

    const buffer = ( this.output.target as BufferTarget ).buffer;

    if ( !buffer ) {
      throw new Error( "MediabunnyEncoder: empty output buffer." );
    }

    return new Blob(
      [
        buffer
      ],
      {
        type: this.mimeType
      }
    );
  }

  dispose(): void {
    this.output?.cancel().catch( () => undefined );
    this.output = null;
    this.source = null;
    this.audioSource = null;
  }
}

export const createMediabunnyEncoderFactory = (
  format: RecordingFormat,
  canvas: HTMLCanvasElement,
  audio?: MediabunnyAudioOptions
): FrameEncoderFactory => {
  return ( params ) =>
    new MediabunnyEncoder(
      format,
      canvas,
      {
        width: params.width,
        height: params.height,
        frameRate: params.frameRate,
        videoBitsPerSecond: params.videoBitsPerSecond,
        audio
      }
    );
};
