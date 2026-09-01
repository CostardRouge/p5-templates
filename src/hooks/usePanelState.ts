"use client";

const STORAGE_KEY = "sketchbook:panel-state";

// Bumped only when the stored shape changes in a way older readers would
// misread. An unknown version is dropped rather than migrated blind: panel
// state is a convenience, and guessing at a foreign shape risks restoring a
// panel into a state its own code no longer understands.
const VERSION = 1;

// Panel state is worth a few kilobytes, not an unbounded log of every sketch
// ever opened. The least recently written record is evicted past this.
const MAX_SKETCHES = 20;

/**
 * Collapsible keys whose state may be persisted.
 *
 * The distinction is what keeps this feature from becoming the "LocalStorage
 * drift" TODO.md warns about. Two shapes of key exist in the options panel:
 *
 *  - **schema-shaped** — the named sections below, plus `nested-…` / `list-…`,
 *    whose paths `getSharedCollapsibleKey` has already stripped of their slide
 *    prefix. They describe the sketch's own form, so they mean the same thing
 *    on every visit.
 *  - **content-shaped** — `conditional-<basePath>`, which addresses an item by
 *    its index. Delete or reorder a layer and the key points at something
 *    else.
 *
 * Only the first kind is stored. An allowlist rather than a denylist on
 * purpose: a new section that nobody adds here simply stops being remembered,
 * where a new content-shaped key nobody excluded would silently rot.
 */
const PERSISTED_SECTIONS: ReadonlySet<string> = new Set( [
  "rootSettings",
  "content",
  "transition",
  "sketchSettings",
  "sketchSection"
] );

const PERSISTED_KEY_PREFIXES = [
  "nested-",
  "list-"
];

export function isPersistableCollapsibleKey( key: string ): boolean {
  if ( PERSISTED_SECTIONS.has( key ) ) {
    return true;
  }

  return PERSISTED_KEY_PREFIXES.some( ( prefix ) => key.startsWith( prefix ) );
}

export type SketchPanelState = {
  /** Collapsible key → expanded. Only persistable keys are ever stored. */
  keys: Record<string, boolean>;
  /** Form path of the layer whose inspector was last opened, if any. */
  layer: string | null;
};

type StoredSketchPanelState = SketchPanelState & {
  /** Last write, epoch ms — the eviction order. */
  at: number;
};

type PanelStateFile = {
  v: number;
  sketches: Record<string, StoredSketchPanelState>;
};

const EMPTY_FILE: PanelStateFile = {
  v: VERSION,
  sketches: {}
};

// Parsed once and kept here so a panel with dozens of collapsible groups does
// not re-parse the whole file per key. Writes go through this cache, so the
// two stores that share a record (the named sections and the dynamic keys)
// merge into it instead of overwriting each other.
//
// Deliberately NOT a useSyncExternalStore store like usePanelDock: nothing
// reads this live. Each consumer hydrates once on mount and writes through
// afterwards, so there is no second tree to keep in step.
let cache: PanelStateFile | null = null;

function isRecord( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

function parseSketchState( value: unknown ): StoredSketchPanelState | null {
  if ( !isRecord( value ) ) {
    return null;
  }

  const keys: Record<string, boolean> = {};

  if ( isRecord( value.keys ) ) {
    for ( const [
      key,
      expanded
    ] of Object.entries( value.keys ) ) {
      if ( typeof expanded === "boolean" && isPersistableCollapsibleKey( key ) ) {
        keys[ key ] = expanded;
      }
    }
  }

  return {
    keys,
    layer: typeof value.layer === "string" ? value.layer : null,
    at: typeof value.at === "number" ? value.at : 0
  };
}

function read(): PanelStateFile {
  if ( cache ) {
    return cache;
  }

  if ( typeof window === "undefined" ) {
    return EMPTY_FILE;
  }

  cache = {
    v: VERSION,
    sketches: {}
  };

  try {
    const stored = localStorage.getItem( STORAGE_KEY );

    if ( stored === null ) {
      return cache;
    }

    const parsed = JSON.parse( stored ) as unknown;

    if ( !isRecord( parsed ) || parsed.v !== VERSION || !isRecord( parsed.sketches ) ) {
      return cache;
    }

    for ( const [
      sketchKey,
      value
    ] of Object.entries( parsed.sketches ) ) {
      const state = parseSketchState( value );

      if ( state ) {
        cache.sketches[ sketchKey ] = state;
      }
    }
  } catch( error ) {
    console.warn(
      `Failed to read ${ STORAGE_KEY } from localStorage:`,
      error
    );
  }

  return cache;
}

function write( file: PanelStateFile ) {
  cache = file;

  if ( typeof window === "undefined" ) {
    return;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify( file )
    );
  } catch( error ) {
    console.warn(
      `Failed to save ${ STORAGE_KEY } to localStorage:`,
      error
    );
  }
}

/** Drop the least recently written records once the cap is exceeded. */
function prune( sketches: Record<string, StoredSketchPanelState> ) {
  const entries = Object.entries( sketches );

  if ( entries.length <= MAX_SKETCHES ) {
    return sketches;
  }

  return Object.fromEntries( entries
    .sort( (
      [
        , a
      ], [
        , b
      ]
    ) => b.at - a.at )
    .slice(
      0,
      MAX_SKETCHES
    ) );
}

function update(
  sketchKey: string,
  change: ( previous: StoredSketchPanelState ) => StoredSketchPanelState
) {
  const file = read();
  const previous = file.sketches[ sketchKey ] ?? {
    keys: {},
    layer: null,
    at: 0
  };

  const next = {
    ...change( previous ),
    at: Date.now()
  };

  write( {
    v: VERSION,
    sketches: prune( {
      ...file.sketches,
      [ sketchKey ]: next
    } )
  } );
}

/**
 * What a sketch's options panel looked like when it was last open — which
 * sections and groups were unfolded, and which layer's inspector was showing.
 *
 * `sketchKey` identifies the page, not the document: `<engineId>:<name>`, the
 * same pair `resolveSketchPath` uses, so returning to a sketch finds its own
 * state and no other's.
 */
export function readSketchPanelState( sketchKey: string ): SketchPanelState | null {
  const stored = read().sketches[ sketchKey ];

  if ( !stored ) {
    return null;
  }

  return {
    keys: stored.keys,
    layer: stored.layer
  };
}

/**
 * Merge collapsible keys into a sketch's record. Merging rather than replacing
 * because two stores write here — the named sections and the dynamic ones —
 * and neither knows the other's keys.
 */
export function saveCollapsibleKeys(
  sketchKey: string,
  keys: Record<string, boolean>
) {
  const persistable = Object.fromEntries( Object.entries( keys )
    .filter( ( [
      key
    ] ) => isPersistableCollapsibleKey( key ) ) );

  update(
    sketchKey,
    ( previous ) => ( {
      ...previous,
      keys: {
        ...previous.keys,
        ...persistable
      }
    } )
  );
}

/** Remember which layer's inspector was last opened (the marker, not the view). */
export function saveOpenLayer(
  sketchKey: string, layer: string | null
) {
  update(
    sketchKey,
    ( previous ) => ( {
      ...previous,
      layer
    } )
  );
}

/** Test-only: drop the parsed cache so a case starts from localStorage again. */
export function __resetPanelStateCache() {
  cache = null;
}
