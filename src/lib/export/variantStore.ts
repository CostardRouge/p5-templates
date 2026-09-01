import {
  duplicateVariant,
  makeVariant,
  VARIANT_PRESETS,
  type ExportVariant,
  type ExportVariantPreset
} from "./variants";

/**
 * The export variant list, per sketch.
 *
 * A module singleton rather than form state, on purpose. Variants are a
 * rendering queue, not part of the document: putting them in the options tree
 * would push them into every persisted job, every `/embed` link and the
 * options import/export JSON, and would make the form's 400ms undo/redo
 * auto-capture fire on every variant tweak. Following the `src/lib/uiSound.ts`
 * precedent keeps the dialog free to unmount without losing the list.
 */

// v2 discards every v1 set on purpose. v1 seeded its default variant with the
// sketch's size and framerate resolved to concrete values, so those variants
// stopped following the sketch the moment it changed — and no migration can
// tell a rate the user pinned deliberately from one that bug pinned for them.
const STORAGE_PREFIX = "sketchbook.export.variants.v2";

type Snapshot = {
  variants: ExportVariant[];
};

const EMPTY: Snapshot = {
  variants: []
};

const snapshots = new Map<string, Snapshot>();
const listeners = new Set<() => void>();

function storageKey( sketchKey: string ): string {
  return `${ STORAGE_PREFIX }:${ sketchKey }`;
}

function notify(): void {
  for ( const listener of listeners ) {
    listener();
  }
}

function persist(
  sketchKey: string, snapshot: Snapshot
): void {
  try {
    window.localStorage.setItem(
      storageKey( sketchKey ),
      JSON.stringify( snapshot.variants )
    );
  } catch {
    // Private mode / quota — the list just won't outlive the session.
  }
}

function load( sketchKey: string ): ExportVariant[] {
  try {
    const raw = window.localStorage.getItem( storageKey( sketchKey ) );

    if ( !raw ) {
      return [];
    }

    const parsed: unknown = JSON.parse( raw );

    return Array.isArray( parsed ) ? parsed as ExportVariant[] : [];
  } catch {
    return [];
  }
}

/**
 * The list for a sketch, seeded on first read.
 *
 * A first-time list is not empty: it holds one variant that follows the
 * sketch's own size and framerate, so "open Export, press the button"
 * reproduces exactly what the old single-shot recorder did — and keeps
 * reproducing it after the canvas or the framerate is changed.
 */
export function ensureVariants( sketchKey: string ): Snapshot {
  const existing = snapshots.get( sketchKey );

  if ( existing ) {
    return existing;
  }

  const stored = load( sketchKey );
  const variants = stored.length > 0
    ? stored
    : [
      makeVariant( VARIANT_PRESETS.find( ( preset ) => preset.key === "current" )! )
    ];

  const snapshot: Snapshot = {
    variants
  };

  snapshots.set(
    sketchKey,
    snapshot
  );

  return snapshot;
}

export function getVariantSnapshot( sketchKey: string ): Snapshot {
  return snapshots.get( sketchKey ) ?? EMPTY;
}

export function subscribeVariants( listener: () => void ): () => void {
  listeners.add( listener );

  return () => {
    listeners.delete( listener );
  };
}

function update(
  sketchKey: string,
  mutate: ( snapshot: Snapshot ) => Snapshot
): void {
  const next = mutate( getVariantSnapshot( sketchKey ) );

  snapshots.set(
    sketchKey,
    next
  );
  persist(
    sketchKey,
    next
  );
  notify();
}

export function addVariant(
  sketchKey: string,
  preset: ExportVariantPreset
): void {
  update(
    sketchKey,
    ( snapshot ) => ( {
      variants: [
        ...snapshot.variants,
        makeVariant( preset )
      ]
    } )
  );
}

export function duplicateVariantById(
  sketchKey: string, id: string
): void {
  update(
    sketchKey,
    ( snapshot ) => {
      const source = snapshot.variants.find( ( variant ) => variant.id === id );

      if ( !source ) {
        return snapshot;
      }

      return {
        variants: [
          ...snapshot.variants,
          duplicateVariant( source )
        ]
      };
    }
  );
}

export function patchVariant(
  sketchKey: string,
  id: string,
  patch: Partial<ExportVariant>
): void {
  update(
    sketchKey,
    ( snapshot ) => ( {
      variants: snapshot.variants.map( ( variant ) => variant.id === id
        ? {
          ...variant,
          ...patch
        }
        : variant )
    } )
  );
}

export function removeVariant(
  sketchKey: string, id: string
): void {
  update(
    sketchKey,
    ( snapshot ) => ( {
      variants: snapshot.variants.filter( ( variant ) => variant.id !== id )
    } )
  );
}
