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
 value: SortField; label: string
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
    value: "template",
    label: "Template"
  },
  {
    value: "duration",
    label: "Duration"
  },
  {
    value: "id",
    label: "ID"
  },
];

export default function SortControls( {
  sortConfig, onSortChange
}: SortControlsProps ) {
  const toggleOrder = () => {
    onSortChange( {
      ...sortConfig,
      order: sortConfig.order === "asc" ? "desc" : "asc"
    } );
  };

  const SortIcon = sortConfig.order === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-2">
      <select
        value={sortConfig.field}
        onChange={( e ) => onSortChange( {
          ...sortConfig,
          field: e.target.value as SortField
        } )}
        className="px-4 py-2.5 rounded-xl bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm font-medium cursor-pointer"
      >
        {SORT_OPTIONS.map( ( option ) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ) )}
      </select>

      <button
        onClick={toggleOrder}
        className="p-2.5 rounded-xl bg-background border border-border hover:border-foreground/30 hover:bg-hover transition-all"
        title={`Sort ${ sortConfig.order === "asc" ? "ascending" : "descending" }`}
      >
        <SortIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
