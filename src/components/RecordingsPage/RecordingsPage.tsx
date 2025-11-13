"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import VideoPreviewModal from "@/components/VideoPreviewModal";
import { usePersistedViewMode } from "@/hooks/usePersistedViewMode";
import useRecordings from "./hooks/useRecordings";
import useRecordingActions from "./hooks/useRecordingActions";
import RecordingsToolbar from "./components/RecordingsToolbar";
import RecordingsTable from "./components/RecordingsTable";
import RecordingsCards from "./components/RecordingsCards";

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

  const { handleClone } = useRecordingActions();

  const [
    view,
    setView
  ] = usePersistedViewMode<"table" | "cards">( "recordings-view-mode", "table" );
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

  // Filter jobs
  const filtered = allJobs.filter( ( job ) => {
    const matchSearch = job.id.includes( search ) || job.template.includes( search );
    const matchStatus = statusFilter === "all" || job.status === statusFilter;
    return matchSearch && matchStatus;
  } );

  const hasFilters = search !== "" || statusFilter !== "all";

  const onClone = async( job: Parameters<typeof handleClone>[0] ) => {
    const newJob = await handleClone( job );
    if ( newJob ) {
      addJob( newJob );
    }
  };

  return (
    <div>
      <div className="space-y-6 p-6">
        {/* Toolbar */}
        <RecordingsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          view={view}
          onViewChange={setView}
          recordingsCount={filtered.length}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-hover/50 mb-4 animate-pulse">
                <Video className="w-8 h-8 text-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Loading recordings...</h3>
              <p className="text-sm text-foreground/60">Please wait while we fetch your recordings</p>
            </div>
          </div>
        )}

        {/* Table View */}
        {!isLoading && view === "table" && (
          <RecordingsTable
            jobs={filtered}
            recordingStartTimes={recordingStartTimesRef.current}
            hasFilters={hasFilters}
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
            jobs={filtered}
            recordingStartTimes={recordingStartTimesRef.current}
            hasFilters={hasFilters}
            onPreview={setPreviewJobId}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onStart={handleStart}
            onClone={onClone}
          />
        )}
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
