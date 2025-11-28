import RecordingCard from "./RecordingCard";
import RecordingsEmptyState from "./RecordingsEmptyState";
import type {
  JobModel
} from "@/types/recording.types";

interface RecordingsCardsProps {
  jobs: JobModel[];
  recordingStartTimes: Record<string, number>;
  hasFilters: boolean;
  selectedIds: Set<string>;
  newlyAddedId: string | null;
  onToggleSelection: ( id: string ) => void;
  onPreview: ( jobId: string ) => void;
  onCancel: ( job: JobModel ) => void;
  onDelete: ( job: JobModel ) => void;
  onRetry: ( job: JobModel ) => void;
  onStart: ( job: JobModel ) => void;
  onClone: ( job: JobModel ) => void;
}

export default function RecordingsCards( {
  jobs,
  recordingStartTimes,
  hasFilters,
  selectedIds,
  newlyAddedId,
  onToggleSelection,
  onPreview,
  onCancel,
  onDelete,
  onRetry,
  onStart,
  onClone
}: RecordingsCardsProps ) {
  if ( jobs.length === 0 ) {
    return (
      <div className="col-span-full overflow-hidden rounded-xl sm:rounded-2xl border border-border bg-background shadow-sm">
        <RecordingsEmptyState hasFilters={hasFilters} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-4">
      {jobs.map( ( job ) => (
        <RecordingCard
          key={job.id}
          job={job}
          startTime={recordingStartTimes[ job.id ]}
          isSelected={selectedIds.has( job.id )}
          isNewlyAdded={newlyAddedId === job.id}
          onToggleSelection={() => onToggleSelection( job.id )}
          onPreview={() => onPreview( job.id )}
          onCancel={onCancel}
          onDelete={onDelete}
          onRetry={onRetry}
          onStart={onStart}
          onClone={onClone}
        />
      ) )}
    </div>
  );
}
