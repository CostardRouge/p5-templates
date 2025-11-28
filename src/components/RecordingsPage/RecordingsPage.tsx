"use client";

import {
  useState, useRef
} from "react";
import {
  Video
} from "lucide-react";
import VideoPreviewModal from "@/components/VideoPreviewModal";
import {
  usePersistedViewMode
} from "@/hooks/usePersistedViewMode";
import {
  usePersistedSort
} from "@/hooks/usePersistedSort";
import useRecordings from "./hooks/useRecordings";
import useRecordingActions from "./hooks/useRecordingActions";
import useBulkActions from "./hooks/useBulkActions";
import {
  useSorting
} from "./hooks/useSorting";
import type {
  SortConfig
} from "./hooks/useSorting";
import RecordingsToolbar from "./components/RecordingsToolbar";
import RecordingsTable from "./components/RecordingsTable";
import RecordingsCards from "./components/RecordingsCards";
import BulkActionsToolbar from "./components/BulkActionsToolbar";

export default function RecordingsPage() {
  const {
    allJobs,
    isLoading,
    recordingStartTimesRef,
    handleCancel,
    handleDelete,
    handleStart,
    handleRetry,
    addJob
  } = useRecordings();

  const contentRef = useRef<HTMLDivElement>( null );
  const [
    newlyAddedId,
    setNewlyAddedId
  ] = useState<string | null>( null );

  const {
    handleClone
  } = useRecordingActions();

  const {
    selectedIds,
    isProcessing,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDelete,
    bulkCancel,
    bulkRetry,
  } = useBulkActions();

  const [
    view,
    setView
  ] = usePersistedViewMode<"table" | "cards">(
    "recordings-view-mode",
    "table"
  );
  const [
    search,
    setSearch
  ] = useState<string>( "" );
  const [
    statusFilter,
    setStatusFilter
  ] = useState<string>( "all" );
  const [
    previewJobId,
    setPreviewJobId
  ] = useState<string | null>( null );
  const [
    sortConfig,
    setSortConfig
  ] = usePersistedSort<SortConfig>(
    "recordings-sort",
    {
      field: "createdAt",
      order: "desc"
    }
  );

  // Filter and sort jobs
  const filtered = allJobs.filter( ( job ) => {
    const matchSearch = job.id.includes( search ) || job.template.includes( search );
    const matchStatus = statusFilter === "all" || job.status === statusFilter;

    return matchSearch && matchStatus;
  } );

  const sorted = useSorting(
    filtered,
    sortConfig
  );
  const hasFilters = search !== "" || statusFilter !== "all";

  // Get selected jobs for bulk actions
  const selectedJobs = sorted.filter( j => selectedIds.has( j.id ) );

  // Toggle select all handler
  const handleToggleSelectAll = () => {
    const allSelected = sorted.length > 0 && sorted.every( j => selectedIds.has( j.id ) );

    if ( allSelected ) {
      clearSelection();
    } else {
      selectAll( sorted );
    }
  };

  // Bulk action handlers
  const handleBulkDelete = async() => {
    const ids = selectedJobs
      .filter( j => [
        "completed",
        "cancelled",
        "draft",
        "failed"
      ].includes( j.status ) )
      .map( j => j.id );

    const result = await bulkDelete( ids );

    if ( result.success ) {
      result.deleted.forEach( id => {
        const job = allJobs.find( j => j.id === id );

        if ( job ) handleDelete( job );
      } );
      clearSelection();
    }
  };

  const handleBulkCancel = async() => {
    const ids = selectedJobs
      .filter( j => j.status === "queued" )
      .map( j => j.id );

    const result = await bulkCancel( ids );

    if ( result.success ) {
      result.cancelled.forEach( id => {
        const job = allJobs.find( j => j.id === id );

        if ( job ) handleCancel( job );
      } );
      clearSelection();
    }
  };

  const handleBulkRetry = async() => {
    const ids = selectedJobs
      .filter( j => [
        "cancelled",
        "failed"
      ].includes( j.status ) )
      .map( j => j.id );

    const result = await bulkRetry( ids );

    if ( result.success ) {
      result.retried.forEach( id => {
        const job = allJobs.find( j => j.id === id );

        if ( job ) handleRetry( job );
      } );
      clearSelection();
    }
  };

  const onClone = async( job: Parameters<typeof handleClone>[0] ) => {
    const newJob = await handleClone( job );

    if ( newJob ) {
      addJob( newJob );
      setNewlyAddedId( newJob.id );

      // Smooth scroll to top
      contentRef.current?.scrollIntoView( {
        behavior: "smooth",
        block: "start"
      } );

      // Remove animation class after animation completes
      setTimeout(
        () => setNewlyAddedId( null ),
        1000
      );
    }
  };

  return (
    <div>
      <div ref={contentRef} className="space-y-3 p-3 sm:space-y-6 sm:p-6">
        {/* Toolbar */}
        <RecordingsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          view={view}
          onViewChange={setView}
          recordingsCount={sorted.length}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-background shadow-sm">
            <div className="text-center py-8 sm:py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-hover/50 mb-3 sm:mb-4 animate-pulse">
                <Video className="w-6 h-6 sm:w-8 sm:h-8 text-foreground/40" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">Loading recordings...</h3>
              <p className="text-xs sm:text-sm text-foreground/60">Please wait while we fetch your recordings</p>
            </div>
          </div>
        )}

        {/* Table View */}
        {!isLoading && view === "table" && (
          <RecordingsTable
            jobs={sorted}
            recordingStartTimes={recordingStartTimesRef.current}
            hasFilters={hasFilters}
            selectedIds={selectedIds}
            newlyAddedId={newlyAddedId}
            onToggleSelection={toggleSelection}
            onSelectAll={handleToggleSelectAll}
            onPreview={setPreviewJobId}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onStart={handleStart}
            onClone={onClone}
          />
        )}

        {/* Card View */}
        {!isLoading && view === "cards" && (
          <RecordingsCards
            jobs={sorted}
            recordingStartTimes={recordingStartTimesRef.current}
            hasFilters={hasFilters}
            selectedIds={selectedIds}
            newlyAddedId={newlyAddedId}
            onToggleSelection={toggleSelection}
            onPreview={setPreviewJobId}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onStart={handleStart}
            onClone={onClone}
          />
        )}

        {/* Bulk Actions Toolbar */}
        <BulkActionsToolbar
          selectedJobs={selectedJobs}
          isProcessing={isProcessing}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkCancel={handleBulkCancel}
          onBulkRetry={handleBulkRetry}
        />
      </div>

      {/* Video Preview Modal */}
      {previewJobId && (
        <VideoPreviewModal
          jobId={previewJobId}
          isOpen={!!previewJobId}
          onClose={() => setPreviewJobId( null )}
        />
      )}
    </div>
  );
}
