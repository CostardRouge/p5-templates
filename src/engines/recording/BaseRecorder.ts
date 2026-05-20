import type {
  Recorder,
  RecorderEventMap,
  RecorderEventName,
  RecorderResult,
  RecordingFormat,
  RecordingMode,
  RecorderStartOptions
} from "./types";

/**
 * Shared event-emitter scaffolding for concrete recorder strategies.
 * Subclasses implement `start` / `stop` / `cancel`; this base owns the
 * listener map + `isRecording` flag.
 */
export abstract class BaseRecorder implements Recorder {
  abstract readonly mode: RecordingMode;
  abstract readonly format: RecordingFormat;

  protected _isRecording = false;
  private listeners = new Map<string, Set<( payload: any ) => void>>();

  get isRecording(): boolean {
    return this._isRecording;
  }

  abstract start( options?: RecorderStartOptions ): Promise<void>;
  abstract stop(): Promise<RecorderResult>;
  abstract cancel(): void;

  on<E extends RecorderEventName>(
    event: E,
    handler: ( payload: RecorderEventMap[ E ] ) => void
  ): void {
    if ( !this.listeners.has( event ) ) {
      this.listeners.set(
        event,
        new Set()
      );
    }

    this.listeners.get( event )!.add( handler );
  }

  off<E extends RecorderEventName>(
    event: E,
    handler: ( payload: RecorderEventMap[ E ] ) => void
  ): void {
    this.listeners.get( event )?.delete( handler );
  }

  protected emit<E extends RecorderEventName>(
    event: E,
    payload: RecorderEventMap[ E ]
  ): void {
    this.listeners.get( event )?.forEach( ( h ) => h( payload ) );
  }
}
