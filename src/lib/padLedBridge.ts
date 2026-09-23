/**
 * What the pads of the connected controller should show — published by the
 * editor, read by the engine, never written to the document.
 *
 * A field that pads drive (a button, a select laid out as a row) knows which
 * of its pads is active; the engine owns the MIDI output and knows which port
 * is open. Neither imports the other: the same module-singleton shape as
 * `declaredBindings` and `channelBridge` carries the wish list across, keyed
 * by ABSTRACT control (`pad.3`) so the editor never names a note number.
 *
 * Several fields light pads at once, so each publishes under its own owner
 * (its form path) and the merge is by control, last publisher winning — two
 * fields claiming one pad is a sketch-authoring mistake, not a crash.
 */

export type PadLedMode = "static" | "flash" | "pulse";

export interface PadLedEntry {
  /** Abstract pad control, e.g. `"pad.3"`. */
  control: string;
  /** Palette index 0–127 sent as the note-on velocity; 0 is off. */
  color: number;
  mode?: PadLedMode;
}

const owners = new Map<string, PadLedEntry[]>();

let merged: PadLedEntry[] = [];

function rebuild(): void {
  const byControl = new Map<string, PadLedEntry>();

  owners.forEach( ( entries ) => {
    entries.forEach( ( entry ) => {
      if ( entry && typeof entry.control === "string" ) {
        byControl.set(
          entry.control,
          entry
        );
      }
    } );
  } );

  merged = Array.from( byControl.values() );
}

/** Replace one owner's wish list. Pass null to withdraw it (field unmount). */
export function publishPadLeds(
  owner: string,
  entries: PadLedEntry[] | null
): void {
  if ( entries === null || entries.length === 0 ) {
    if ( !owners.delete( owner ) ) {
      return;
    }
  } else {
    owners.set(
      owner,
      entries
    );
  }

  rebuild();
}

/**
 * Every pad wish, merged. The SAME array until the next publish, so the
 * engine's per-frame read can compare identity and skip the diff.
 */
export function getPadLeds(): PadLedEntry[] {
  return merged;
}

/** Test hook: forget every owner. */
export function resetPadLeds(): void {
  owners.clear();
  merged = [];
}
