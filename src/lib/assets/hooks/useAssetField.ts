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
      if ( !Array.isArray( rawValue ) ) {
        return [];
      }
      return rawValue
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
    ( index: number, params: P ) => {
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

  /** Single-asset variant: replace the (sole) instance's path. */
  const setSinglePath = useCallback(
    ( path: string ) => {
      const head = instances[ 0 ];

      if ( !path ) {
        field.onChange( "" );
        return;
      }
      if ( head ) {
        writeInstances( [
          {
            ...head,
            path
          }
        ] );
      } else {
        writeInstances( [
          {
            id: makeAssetId(),
            path,
            params: kind.defaultParams()
          }
        ] );
      }
    },
    [
      field,
      instances,
      writeInstances,
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
