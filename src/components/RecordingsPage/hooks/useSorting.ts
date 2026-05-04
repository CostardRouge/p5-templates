import {
  useMemo
} from "react";
import type {
  JobModel
} from "@/types/recording.types";

export type SortField =
  | "createdAt"
  | "updatedAt"
  | "status"
  | "template"
  | "duration"
  | "id";
export type SortOrder = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  queued: 1,
  draft: 2,
  completed: 3,
  failed: 4,
  cancelled: 5
};

export function useSorting(
  jobs: JobModel[], sortConfig: SortConfig
) {
  return useMemo(
    () => {
      if ( !jobs.length ) {
        return jobs;
      }

      const sorted = [
        ...jobs
      ].sort( (
        a, b
      ) => {
        let comparison = 0;

        switch ( sortConfig.field ) {
          case "createdAt":
          case "updatedAt":
            comparison =
              new Date( a[ sortConfig.field ] ).getTime() -
            new Date( b[ sortConfig.field ] ).getTime();
            break;

          case "status":
            comparison = STATUS_ORDER[ a.status ] - STATUS_ORDER[ b.status ];
            break;

          case "template":
            comparison = a.template.localeCompare( b.template );
            break;

          case "duration":
            comparison = ( a.recordingDuration || 0 ) - ( b.recordingDuration || 0 );
            break;

          case "id":
            comparison = a.id.localeCompare( b.id );
            break;
        }

        return sortConfig.order === "asc" ? comparison : -comparison;
      } );

      return sorted;
    },
    [
      jobs,
      sortConfig
    ]
  );
}
