import { Grid, List } from "lucide-react";

interface RecordingsToolbarProps {
  search: string;
  onSearchChange: ( value: string ) => void;
  statusFilter: string;
  onStatusFilterChange: ( value: string ) => void;
  view: "table" | "cards";
  onViewChange: ( view: "table" | "cards" ) => void;
  recordingsCount: number;
}

export default function RecordingsToolbar( {
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  view,
  onViewChange,
  recordingsCount
}: RecordingsToolbarProps ) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Recordings</h1>
        <p className="text-sm text-foreground/60 mt-1">
          {recordingsCount} {recordingsCount === 1 ? "recording" : "recordings"}
          {statusFilter !== "all" && ` • ${statusFilter}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-shrink min-w-0">
          <input
            type="text"
            placeholder="Search recordings..."
            value={search}
            onChange={( e ) => onSearchChange( e.target.value )}
            className="pl-4 pr-4 py-2.5 rounded-xl w-full sm:w-56 bg-background border border-border hover:border-foreground/30 focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all text-sm placeholder:text-foreground/40"
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
    </div>
  );
}
