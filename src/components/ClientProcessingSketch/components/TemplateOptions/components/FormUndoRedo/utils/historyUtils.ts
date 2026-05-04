import {
  applyPatches, enablePatches, produceWithPatches, Patch
} from "immer";
import type {
  HistoryEntry
} from "../types/FormUndoRedo.types";

// Enable Immer patches
enablePatches();

/**
 * Create a stable hash for state comparison
 */
export function createStateHash( state: any ): string {
  try {
    return JSON.stringify( state );
  } catch( error ) {
    console.warn(
      "Failed to hash state:",
      error
    );
    return String( Date.now() );
  }
}

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

/**
 * Create a history entry with patches
 */
export function createHistoryEntry<T>(
  state: T,
  previousState?: T,
  description?: string,
  affectedPaths?: string[],
  batchId?: string
): HistoryEntry<T> {
  const entry: HistoryEntry<T> = {
    state: safeDeepClone( state ),
    timestamp: Date.now(),
    description,
    affectedPaths,
    batchId
  };

  // Generate patches if we have a previous state
  if ( previousState ) {
    try {
      const [
        , patches,
        inversePatches
      ] = produceWithPatches(
        previousState,
        () => state
      );

      entry.patches = patches;
      entry.inversePatches = inversePatches;
    } catch( error ) {
      console.warn(
        "Failed to generate patches:",
        error
      );
    }
  }

  return entry;
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
  const last = entries[ entries.length - 1 ];

  return {
    state: last.state,
    timestamp: first.timestamp,
    description:
      first.description || `Batch operation (${ entries.length } changes)`,
    affectedPaths: Array.from( new Set( entries.flatMap( ( e ) => e.affectedPaths || [] ) ) ),
    batchId: first.batchId
  };
}
