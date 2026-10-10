/**
 * What the studio commands may touch, handed in by the sketch page
 * (`useStudioCommands`) — each one a funnel a control already uses:
 * react-hook-form's `setValue` for every field (the form is the source of
 * truth: it reaches the engine, the undo history and saving; a write straight
 * into the option store would reach the engine only), the slide handlers of
 * `useSlideManagement`, the transport's play/pause, the progression bridge's
 * seek, the snapshot button's capture, the content rail's item factory.
 *
 * Plain functions, so the commands are tested without React or a canvas.
 */
import type {
  ImageResult
} from "../../../scripts/mcp/registry.ts";

export interface StudioHandles {
  /** `<engine>/<category>/<name>`. */
  sketchId: string;
  engineId: string;
  /** The form's value at a dotted path, or the whole document. */
  getValues: ( path?: string ) => unknown;
  /** One field written as a control writes it (dirty, validated, history captured). */
  setValue: ( path: string, value: unknown ) => void;
  /** The sketch's controls and stock defaults (`options.ts`). */
  formConfiguration: Record<string, unknown>;
  formValues: Record<string, unknown>;
  activeSlide: () => number | undefined;
  slides: {
    select: ( index: number ) => void;
    add: () => void;
    duplicate: ( index: number ) => void;
    remove: ( index: number ) => void;
    move: ( from: number, to: number ) => void;
    rename: ( index: number, name: string ) => void;
  };
  history: {
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
  };
  playback: {
    isPlaying: () => boolean;
    play: () => void;
    pause: () => void;
    /** Loop position 0..1, as the progression bar scrubs. */
    seek: ( progress: number ) => void;
    progress: () => number | null;
  };
  /** The engine's clock (`__sketchCapture.timing()`), when it has one. */
  timing: () => { frameRate: number;
    duration: number;
    totalFrames: number } | null;
  /** The current frame as a PNG, the snapshot button's own capture. */
  snapshot: () => Promise<Blob | null>;
  /** A picture for the agent: scaled to `maxEdge`, re-encoded. */
  imageResult: ( blob: Blob, maxEdge: number, format: "png" | "jpeg", note: string ) => Promise<ImageResult>;
  /** Open an item in the content inspector (null closes it). */
  selectPath: ( path: string | null ) => void;
  /** A content item of `kind` with every default, `seed` over them (`makeDefaultItem`). */
  makeItem: ( kind: string, seed: Record<string, unknown> ) => Record<string, unknown>;
  /** The app's own schema verdict on a document (`validateOptionsDocument`). */
  validateDocument: ( document: unknown ) => { issues: { path: string;
    message: string }[];
  normalized: Record<string, unknown> | null };
  /** Randomize every control under `basePath`, as the dice button does. */
  randomize: ( basePath: string ) => void;
  /** Write a file through the relay; null when no relay is connected. */
  saveFile: ( blob: Blob, name: string, folder?: string ) => Promise<{ path: string;
    bytes: number }>;
  relayConnected: () => boolean;
}

/** The sketch-parameter scope a slide edits: its own block, or the root's. */
export function sketchBase( slide: number | undefined ): string {
  return slide === undefined ? "sketch" : `slides.${ slide }.sketch`;
}

function isPlainObject( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

/**
 * A nested delta as the leaf writes a form makes: one `[path, value]` per
 * scalar, an array written whole (the option store treats arrays as leaves).
 */
export function leafWrites(
  base: string, delta: Record<string, unknown>
): [ string, unknown ][] {
  const out: [ string, unknown ][] = [];

  for ( const [
    key,
    value
  ] of Object.entries( delta ) ) {
    const path = base ? `${ base }.${ key }` : key;

    if ( isPlainObject( value ) && Object.keys( value ).length ) {
      out.push( ...leafWrites(
        path,
        value
      ) );
    } else {
      out.push( [
        path,
        value
      ] );
    }
  }

  return out;
}
