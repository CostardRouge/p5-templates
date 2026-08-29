import {
  duplicateVariant,
  makeVariant,
  VARIANT_PRESETS,
  type ExportVariant,
  type ExportVariantPreset
} from "./variants";
import type {
  SketchOption
} from "@/types/sketch.types";

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

const STORAGE_PREFIX = "sketchbook.export.variants.v1";

type Snapshot = {
  variants: ExportVariant[];
  selectedId: string | null;
};

const EMPTY: Snapshot = {
  variants: [],
  selectedId: null
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
 * A first-time list is not empty: it holds one variant matching the sketch's
 * current canvas, so "open Export, press the button" reproduces exactly what
 * the old single-shot recorder did.
 */
export function ensureVariants(
  sketchKey: string,
  options: SketchOption,
  activeSlideIndex: number | undefined
): Snapshot {
  const existing = snapshots.get( sketchKey );

  if ( existing ) {
    return existing;
  }

  const stored = load( sketchKey );
  const variants = stored.length > 0
    ? stored
    : [
      makeVariant(
        VARIANT_PRESETS.find( ( preset ) => preset.key === "current" )!,
        options,
        activeSlideIndex
      )
    ];

  const snapshot: Snapshot = {
    variants,
    selectedId: variants[ 0 ]?.id ?? null
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
  preset: ExportVariantPreset,
  options: SketchOption,
  activeSlideIndex: number | undefined
): void {
  update(
    sketchKey,
    ( snapshot ) => {
      const variant = makeVariant(
        preset,
        options,
        activeSlideIndex
      );

      return {
        variants: [
          ...snapshot.variants,
          variant
        ],
        selectedId: variant.id
      };
    }
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

      const copy = duplicateVariant( source );

      return {
        variants: [
          ...snapshot.variants,
          copy
        ],
        selectedId: copy.id
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
      ...snapshot,
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
    ( snapshot ) => {
      const variants = snapshot.variants.filter( ( variant ) => variant.id !== id );

      return {
        variants,
        selectedId: snapshot.selectedId === id
          ? variants[ 0 ]?.id ?? null
          : snapshot.selectedId
      };
    }
  );
}

export function selectVariant(
  sketchKey: string, id: string
): void {
  update(
    sketchKey,
    ( snapshot ) => ( {
      ...snapshot,
      selectedId: id
    } )
  );
}
