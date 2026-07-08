import {
  ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import type {
  SortConfig, SortField
} from "../hooks/useSorting";

interface SortControlsProps {
  sortConfig: SortConfig;
  onSortChange: ( config: SortConfig ) => void;
}

const SORT_OPTIONS: {
  value: SortField;
  label: string;
}[] = [
  {
    value: "createdAt",
    label: "Created Date"
  },
  {
    value: "updatedAt",
    label: "Updated Date"
  },
  {
    value: "status",
    label: "Status"
  },
  {
    value: "sketch",
    label: "Sketch"
  },
  {
    value: "duration",
    label: "Duration"
  },
  {
    value: "id",
    label: "ID"
  }
];

export default function SortControls( {
  sortConfig,
  onSortChange
}: SortControlsProps ) {
  const toggleOrder = () => {
    onSortChange( {
      ...sortConfig,
      order: sortConfig.order === "asc" ? "desc" : "asc"
    } );
  };

  const SortIcon = sortConfig.order === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <select
        value={ sortConfig.field }
        onChange={ ( e ) =>
          onSortChange( {
            ...sortConfig,
            field: e.target.value as SortField
          } )
        }
        className="px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-xs sm:text-sm font-medium cursor-pointer flex-shrink-0 min-w-0"
      >
        {SORT_OPTIONS.map( ( option ) => (
          <option key={ option.value } value={ option.value }>
            Sort: {option.label}
          </option>
        ) )}
      </select>

      <button
        onClick={ toggleOrder }
        className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-background border border-border hover:border-foreground/30 hover:bg-hover transition-all flex-shrink-0"
        title={ `Sort ${ sortConfig.order === "asc" ? "ascending" : "descending" }` }
      >
        <SortIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}
