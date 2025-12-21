import {
  Grid, List
} from "lucide-react";
import SortControls from "./SortControls";
import type {
  SortConfig
} from "../hooks/useSorting";

interface RecordingsToolbarProps {
  search: string;
  onSearchChange: ( value: string ) => void;
  statusFilter: string;
  onStatusFilterChange: ( value: string ) => void;
  view: "table" | "cards";
  onViewChange: ( view: "table" | "cards" ) => void;
  recordingsCount: number;
  sortConfig: SortConfig;
  onSortChange: ( config: SortConfig ) => void;
}

export default function RecordingsToolbar( {
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  view,
  onViewChange,
  recordingsCount,
  sortConfig,
  onSortChange,
}: RecordingsToolbarProps ) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Recordings
        </h1>
        <p className="text-xs sm:text-sm text-foreground/60 mt-0.5 sm:mt-1">
          {recordingsCount} {recordingsCount === 1 ? "recording" : "recordings"}
          {statusFilter !== "all" && ` • ${ statusFilter }`}
        </p>
      </div>

      {/* Desktop: Single row with all controls */}
      <div className="hidden sm:flex items-center gap-2 w-full">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={( e ) => onSearchChange( e.target.value )}
            className="px-4 py-2.5 rounded-xl w-full bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm placeholder:text-foreground/40"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={( e ) => onStatusFilterChange( e.target.value )}
          className="px-4 py-2.5 rounded-xl bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm font-medium cursor-pointer flex-shrink-0"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="queued">Queued</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Sort Controls */}
        <SortControls sortConfig={sortConfig} onSortChange={onSortChange} />

        {/* View Toggle */}
        <div className="flex items-center bg-background border border-border rounded-xl overflow-hidden flex-shrink-0">
          <button
            onClick={() => onViewChange( "cards" )}
            className={`px-3 py-2.5 transition-all duration-200 ${
              view === "cards"
                ? "bg-hover text-foreground"
                : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
            }`}
            title="Card view"
          >
            <Grid className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border" />

          <button
            onClick={() => onViewChange( "table" )}
            className={`px-3 py-2.5 transition-all duration-200 ${
              view === "table"
                ? "bg-hover text-foreground"
                : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
            }`}
            title="Table view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile: Search on top, filters and toggle below */}
      <div className="flex sm:hidden flex-col gap-2">
        {/* Search Input - Full width on top */}
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={( e ) => onSearchChange( e.target.value )}
            className="px-3 py-2 rounded-lg w-full bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-xs placeholder:text-foreground/40"
          />
        </div>

        {/* Filters and Toggle Row */}
        <div className="flex items-center gap-2">
          {/* Left: Status, Sort, Sort Direction */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={( e ) => onStatusFilterChange( e.target.value )}
              className="px-2.5 py-2 rounded-lg bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-xs font-medium cursor-pointer flex-shrink-0 min-w-0"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="queued">Queued</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Sort Controls */}
            <SortControls sortConfig={sortConfig} onSortChange={onSortChange} />
          </div>

          {/* Right: View Toggle */}
          <div className="flex items-center bg-background border border-border rounded-lg overflow-hidden flex-shrink-0">
            <button
              onClick={() => onViewChange( "cards" )}
              className={`px-2.5 py-2 transition-all duration-200 ${
                view === "cards"
                  ? "bg-hover text-foreground"
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
              }`}
              title="Card view"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 bg-border" />

            <button
              onClick={() => onViewChange( "table" )}
              className={`px-2.5 py-2 transition-all duration-200 ${
                view === "table"
                  ? "bg-hover text-foreground"
                  : "text-foreground/60 hover:text-foreground hover:bg-hover/50"
              }`}
              title="Table view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
