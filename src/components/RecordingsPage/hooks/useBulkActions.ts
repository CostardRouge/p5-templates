import { useState, useCallback } from "react";
import type { JobModel } from "@/types/recording.types";

export default function useBulkActions() {
  const [
    selectedIds,
    setSelectedIds
  ] = useState<Set<string>>( new Set() );
  const [
    isProcessing,
    setIsProcessing
  ] = useState( false );

  const toggleSelection = useCallback( ( id: string ) => {
    setSelectedIds( prev => {
      const next = new Set( prev );
      if ( next.has( id ) ) {
        next.delete( id );
      } else {
        next.add( id );
      }
      return next;
    } );
  }, [] );

  const selectAll = useCallback( ( jobs: JobModel[] ) => {
    setSelectedIds( new Set( jobs.map( j => j.id ) ) );
  }, [] );

  const clearSelection = useCallback( () => {
    setSelectedIds( new Set() );
  }, [] );

  const bulkDelete = useCallback( async( ids: string[] ) => {
    if ( !confirm( `Delete ${ids.length} recording(s)? This cannot be undone.` ) ) {
      return { success: false, deleted: [] };
    }

    setIsProcessing( true );
    const deleted: string[] = [];

    try {
      await Promise.all(
        ids.map( async( id ) => {
          try {
            const res = await fetch( `/api/recordings/${id}`, { method: "DELETE" } );
            if ( res.ok ) deleted.push( id );
          } catch ( err ) {
            console.error( `Failed to delete ${id}:`, err );
          }
        } )
      );

      return { success: true, deleted };
    } finally {
      setIsProcessing( false );
    }
  }, [] );

  const bulkCancel = useCallback( async( ids: string[] ) => {
    if ( !confirm( `Cancel ${ids.length} recording(s)?` ) ) {
      return { success: false, cancelled: [] };
    }

    setIsProcessing( true );
    const cancelled: string[] = [];

    try {
      await Promise.all(
        ids.map( async( id ) => {
          try {
            const res = await fetch( `/api/recordings/${id}/cancel`, { method: "POST" } );
            if ( res.ok ) cancelled.push( id );
          } catch ( err ) {
            console.error( `Failed to cancel ${id}:`, err );
          }
        } )
      );

      return { success: true, cancelled };
    } finally {
      setIsProcessing( false );
    }
  }, [] );

  const bulkRetry = useCallback( async( ids: string[] ) => {
    if ( !confirm( `Retry ${ids.length} recording(s)?` ) ) {
      return { success: false, retried: [] };
    }

    setIsProcessing( true );
    const retried: string[] = [];

    try {
      await Promise.all(
        ids.map( async( id ) => {
          try {
            const res = await fetch( `/api/recordings/${id}/retry`, { method: "POST" } );
            if ( res.ok ) retried.push( id );
          } catch ( err ) {
            console.error( `Failed to retry ${id}:`, err );
          }
        } )
      );

      return { success: true, retried };
    } finally {
      setIsProcessing( false );
    }
  }, [] );

  return {
    selectedIds,
    isProcessing,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDelete,
    bulkCancel,
    bulkRetry,
  };
}
