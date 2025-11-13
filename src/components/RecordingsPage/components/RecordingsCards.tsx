import RecordingCard from "./RecordingCard";
import RecordingsEmptyState from "./RecordingsEmptyState";
import type { JobModel } from "@/types/recording.types";

interface RecordingsCardsProps {
  jobs: JobModel[];
  recordingStartTimes: Record<string, number>;
  hasFilters: boolean;
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
  onPreview,
  onCancel,
  onDelete,
  onRetry,
  onStart,
  onClone
}: RecordingsCardsProps ) {
  if ( jobs.length === 0 ) {
    return (
      <div className="col-span-full overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <RecordingsEmptyState hasFilters={hasFilters} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
      {jobs.map( ( job ) => (
        <RecordingCard
          key={job.id}
          job={job}
          startTime={recordingStartTimes[job.id]}
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
