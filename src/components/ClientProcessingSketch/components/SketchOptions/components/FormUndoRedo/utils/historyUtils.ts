import {
  applyPatches, enablePatches, produceWithPatches, setAutoFreeze, Patch
} from "immer";
import {
  valuesEqual
} from "@/p5/shared/utils.js";
import type {
  HistoryEntry
} from "../types/FormUndoRedo.types";

// Enable Immer patches. Auto-freeze is disabled because patch values and
// reconstructed states are handed to react-hook-form's reset(), which must
// stay free to mutate its own form state.
enablePatches();
setAutoFreeze( false );

/**
 * Deep clone with circular reference handling
 */
export function safeDeepClone<T>( obj: T ): T {
  try {
    // Use structuredClone if available (modern browsers)
    if ( typeof structuredClone === "function" ) {
      return structuredClone( obj );
    }
    // Fallback to JSON (loses functions, symbols, etc.)
    return JSON.parse( JSON.stringify( obj ) );
  } catch( error ) {
    console.warn(
      "Failed to clone state:",
      error
    );
    return obj;
  }
}

function isPlainRecord( value: any ): boolean {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

/**
 * Mutates an Immer draft field-by-field until it matches `next`, so the
 * produced patches describe only the values that actually changed. Assigning
 * the whole next state at once would yield a single root-replace patch — a
 * full snapshot — which is exactly the memory cost this module avoids.
 * Changed values are cloned so patches never alias live form state.
 */
function applyStateDiff(
  draft: any, next: any
): void {
  for ( const key of Object.keys( draft ) ) {
    if ( !( key in next ) ) {
      delete draft[ key ];
    }
  }

  for ( const key of Object.keys( next ) ) {
    const nextValue = next[ key ];
    const draftValue = draft[ key ];

    if ( isPlainRecord( nextValue ) && isPlainRecord( draftValue ) ) {
      applyStateDiff(
        draftValue,
        nextValue
      );
    } else if ( !valuesEqual(
      draftValue,
      nextValue
    ) ) {
      draft[ key ] = safeDeepClone( nextValue );
    }
  }
}

/**
 * Create a history entry holding the granular patches between two states.
 * Returns null when the states are effectively equal (nothing to record) or
 * when diffing fails.
 */
export function createHistoryEntry<T>(
  previousState: T,
  nextState: T,
  description?: string,
  batchId?: string
): HistoryEntry<T> | null {
  try {
    const [
      , patches,
      inversePatches
    ] = produceWithPatches(
      previousState,
      ( draft: any ) => {
        applyStateDiff(
          draft,
          nextState
        );
      }
    );

    if ( patches.length === 0 ) {
      return null;
    }

    return {
      patches,
      inversePatches,
      timestamp: Date.now(),
      description,
      affectedPaths: extractAffectedPaths( patches ),
      batchId
    };
  } catch( error ) {
    console.warn(
      "Failed to diff states for history:",
      error
    );
    return null;
  }
}

/**
 * Apply patches to reconstruct state
 */
export function applyHistoryPatches<T>(
  baseState: T, patches: Patch[]
): T {
  try {
    return applyPatches(
      baseState as any,
      patches
    ) as T;
  } catch( error ) {
    console.error(
      "Failed to apply patches:",
      error
    );
    return baseState;
  }
}

/**
 * Estimate memory usage of history
 */
export function estimateHistorySize( stacks: {
  past: HistoryEntry[];
  future: HistoryEntry[];
} ): number {
  try {
    const str = JSON.stringify( stacks );

    // Rough estimate: 2 bytes per character in UTF-16
    return str.length * 2;
  } catch {
    return 0;
  }
}

/**
 * Check if a field path should be tracked
 */
export function shouldTrackPath(
  fieldName: string | undefined,
  watchPaths?: string[]
): boolean {
  if ( !watchPaths || watchPaths.length === 0 ) {
    return true;
  }
  if ( !fieldName ) {
    return true;
  }

  return watchPaths.some( ( path ) => fieldName === path || fieldName.startsWith( path + "." ) );
}

/**
 * Extract affected paths from Immer patches
 */
export function extractAffectedPaths( patches: Patch[] ): string[] {
  const paths = new Set<string>();

  patches.forEach( ( patch ) => {
    const path = patch.path.join( "." );

    if ( path ) {
      paths.add( path );
    }
  } );

  return Array.from( paths );
}

/**
 * Compress history by removing redundant entries
 */
export function compressHistory<T>(
  entries: HistoryEntry<T>[],
  maxSize: number
): HistoryEntry<T>[] {
  if ( entries.length <= maxSize ) {
    return entries;
  }

  // Keep most recent entries
  return entries.slice( -maxSize );
}

/**
 * Merge consecutive entries in the same batch
 */
export function mergeBatchEntries<T>( entries: HistoryEntry<T>[] ): HistoryEntry<T>[] {
  if ( entries.length === 0 ) {
    return entries;
  }

  const merged: HistoryEntry<T>[] = [];

  let currentBatch: HistoryEntry<T>[] = [];
  let currentBatchId: string | undefined;

  entries.forEach( ( entry ) => {
    if ( entry.batchId && entry.batchId === currentBatchId ) {
      currentBatch.push( entry );
    } else {
      // Flush previous batch
      if ( currentBatch.length > 0 ) {
        merged.push( mergeBatchGroup( currentBatch ) );
      }
      // Start new batch or add standalone entry
      if ( entry.batchId ) {
        currentBatch = [
          entry
        ];
        currentBatchId = entry.batchId;
      } else {
        merged.push( entry );
        currentBatch = [];
        currentBatchId = undefined;
      }
    }
  } );

  // Flush final batch
  if ( currentBatch.length > 0 ) {
    merged.push( mergeBatchGroup( currentBatch ) );
  }

  return merged;
}

function mergeBatchGroup<T>( entries: HistoryEntry<T>[] ): HistoryEntry<T> {
  if ( entries.length === 1 ) {
    return entries[ 0 ];
  }

  const first = entries[ 0 ];

  return {
    // Forward patches replay in order; inverse patches unwind in reverse.
    patches: entries.flatMap( ( e ) => e.patches ),
    inversePatches: [
      ...entries
    ].reverse()
      .flatMap( ( e ) => e.inversePatches ),
    timestamp: first.timestamp,
    description:
      first.description || `Batch operation (${ entries.length } changes)`,
    affectedPaths: Array.from( new Set( entries.flatMap( ( e ) => e.affectedPaths || [] ) ) ),
    batchId: first.batchId
  };
}
