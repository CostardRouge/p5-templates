"use client";
import {
  useCallback, useMemo
} from "react";
import {
  useController, useFormContext
} from "react-hook-form";

import {
  getAssetKind
} from "../registry";
import type {
  AssetInstance
} from "../types";
import {
  makeAssetId
} from "../utils/makeId";

/**
 * Bridges a react-hook-form array field to a normalized `AssetInstance[]`
 * regardless of whether the persisted shape is `string[]` (images) or
 * `AssetInstance[]` (videos, …). The kind drives the (de)serialization,
 * so consumers only deal with instances.
 */
export default function useAssetField<P>( {
  name,
  kindId
}: {
  name: string;
  kindId: string;
} ) {
  const kind = getAssetKind<P>( kindId );

  const {
    control
  } = useFormContext();
  const {
    field
  } = useController( {
    name,
    control
  } );

  const rawValue = field.value;

  const instances: AssetInstance<P>[] = useMemo(
    () => {
      // Single-asset fields (the `image`/`asset` components) seed their option
      // as a bare value — a string path for images, an object for richer kinds
      // — rather than the canonical array. Accept both shapes so the picker
      // preview reflects a value that was set as a bare scalar, instead of
      // silently rendering an empty drop zone over an already-selected asset.
      const entries = Array.isArray( rawValue )
        ? rawValue
        : rawValue === null || rawValue === undefined || rawValue === ""
          ? []
          : [
            rawValue
          ];

      return entries
        .filter( ( entry ) => entry !== null && entry !== undefined && entry !== "" )
        .map( ( entry ) => kind.parseFieldEntry(
          entry,
          makeAssetId
        ) );
    },
    [
      rawValue,
      kind
    ]
  );

  const writeInstances = useCallback(
    ( next: AssetInstance<P>[] ) => {
      field.onChange( next.map( ( instance ) => kind.serializeFieldEntry( instance ) ) );
    },
    [
      field,
      kind
    ]
  );

  /** Append new paths as fresh instances with default params. */
  const appendPaths = useCallback(
    ( paths: string[] ) => {
      if ( !paths.length ) {
        return;
      }
      const additions = paths.map( ( path ): AssetInstance<P> => ( {
        id: makeAssetId(),
        path,
        params: kind.defaultParams()
      } ) );

      writeInstances( [
        ...instances,
        ...additions
      ] );
    },
    [
      instances,
      writeInstances,
      kind
    ]
  );

  const removeAt = useCallback(
    ( index: number ): string | undefined => {
      if ( index < 0 || index >= instances.length ) {
        return undefined;
      }
      const removed = instances[ index ];
      const next = instances.filter( (
        _, i
      ) => i !== index );

      writeInstances( next );
      return removed.path;
    },
    [
      instances,
      writeInstances
    ]
  );

  const reorder = useCallback(
    (
      fromIndex: number, toIndex: number
    ) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= instances.length ||
        toIndex >= instances.length
      ) {
        return;
      }
      const next = [
        ...instances
      ];
      const [
        moved
      ] = next.splice(
        fromIndex,
        1
      );

      next.splice(
        toIndex,
        0,
        moved
      );
      writeInstances( next );
    },
    [
      instances,
      writeInstances
    ]
  );

  const updateParams = useCallback(
    (
      index: number, params: P
    ) => {
      if ( index < 0 || index >= instances.length ) {
        return;
      }
      const next = instances.map( (
        instance, i
      ) => ( i === index ? {
        ...instance,
        params
      } : instance ) );

      writeInstances( next );
    },
    [
      instances,
      writeInstances
    ]
  );

  /**
   * Single-asset variant: replace the (sole) instance's path.
   *
   * Writes back a bare scalar (the serialized entry — a string for images)
   * rather than a one-element array, so a single-asset field keeps the same
   * shape it was seeded with. Otherwise the first edit would silently promote
   * `photo.image` from `"…": string` to `["…"]: string[]`, which the sketches
   * that read the value as a plain path then fail to resolve.
   */
  const setSinglePath = useCallback(
    ( path: string ) => {
      if ( !path ) {
        field.onChange( "" );
        return;
      }

      const head = instances[ 0 ];
      const entry: AssetInstance<P> = head
        ? {
          ...head,
          path
        }
        : {
          id: makeAssetId(),
          path,
          params: kind.defaultParams()
        };

      field.onChange( kind.serializeFieldEntry( entry ) );
    },
    [
      field,
      instances,
      kind
    ]
  );

  return {
    kind,
    instances,
    appendPaths,
    removeAt,
    reorder,
    updateParams,
    setSinglePath
  };
}
