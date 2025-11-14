import RecordingRow from "./RecordingRow";
import RecordingsEmptyState from "./RecordingsEmptyState";
import type { JobModel } from "@/types/recording.types";

interface RecordingsTableProps {
  jobs: JobModel[];
  recordingStartTimes: Record<string, number>;
  hasFilters: boolean;
  selectedIds: Set<string>;
  onToggleSelection: ( id: string ) => void;
  onSelectAll: () => void;
  onPreview: ( jobId: string ) => void;
  onCancel: ( job: JobModel ) => void;
  onDelete: ( job: JobModel ) => void;
  onRetry: ( job: JobModel ) => void;
  onStart: ( job: JobModel ) => void;
  onClone: ( job: JobModel ) => void;
}

export default function RecordingsTable( {
  jobs,
  recordingStartTimes,
  hasFilters,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onPreview,
  onCancel,
  onDelete,
  onRetry,
  onStart,
  onClone
}: RecordingsTableProps ) {
  const allSelected = jobs.length > 0 && jobs.every( j => selectedIds.has( j.id ) );
  const someSelected = jobs.some( j => selectedIds.has( j.id ) ) && !allSelected;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border bg-hover/30">
              <th className="text-left px-4 py-4 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if ( input ) input.indeterminate = someSelected;
                  }}
                  onChange={onSelectAll}
                  className="w-4 h-4 rounded border-border text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                />
              </th>
              <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                Preview
              </th>
              <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                ID
              </th>
              <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                Template
              </th>
              <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                Created
              </th>
              <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                Status
              </th>
              <th className="text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                Progress
              </th>
              <th className="text-right text-xs font-semibold text-foreground/70 uppercase tracking-wider px-4 py-4">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {jobs.map( ( job ) => (
              <RecordingRow
                key={job.id}
                job={job}
                startTime={recordingStartTimes[job.id]}
                isSelected={selectedIds.has( job.id )}
                onToggleSelection={() => onToggleSelection( job.id )}
                onPreview={() => onPreview( job.id )}
                onCancel={onCancel}
                onDelete={onDelete}
                onRetry={onRetry}
                onStart={onStart}
                onClone={onClone}
              />
            ) )}
          </tbody>
        </table>
      </div>
      
      {jobs.length === 0 && (
        <RecordingsEmptyState hasFilters={hasFilters} />
      )}
    </div>
  );
}
