import {
  Video
} from "lucide-react";

interface RecordingsEmptyStateProps {
  hasFilters: boolean;
}

export default function RecordingsEmptyState( {
  hasFilters,
}: RecordingsEmptyStateProps ) {
  return (
    <div className="text-center py-8 sm:py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-hover/50 mb-3 sm:mb-4">
        <Video className="w-6 h-6 sm:w-8 sm:h-8 text-foreground/40" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
        No recordings found
      </h3>
      <p className="text-xs sm:text-sm text-foreground/60">
        {hasFilters
          ? "Try adjusting your filters"
          : "Create your first recording to get started"}
      </p>
    </div>
  );
}
