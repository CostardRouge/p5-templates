# RecordingsPage Component

A modular, maintainable implementation of the recordings page with reusable components and hooks.

## Structure

```
RecordingsPage/
├── RecordingsPage.tsx          # Main container component
├── index.ts                    # Public exports
├── components/                 # UI components
│   ├── RecordingsTable.tsx     # Table view container
│   ├── RecordingsCards.tsx     # Cards view container
│   ├── RecordingRow.tsx        # Individual table row
│   ├── RecordingCard.tsx       # Individual card
│   ├── RecordingThumbnail.tsx  # Thumbnail with fallback
│   ├── RecordingsToolbar.tsx   # Search, filters, view toggle
│   ├── RecordingsEmptyState.tsx # Empty state UI
│   ├── StatusBadge.tsx         # Status badge component
│   ├── ActionsMenu.tsx         # Actions dropdown menu
│   └── DownloadMenuItems.tsx   # Download menu items
├── hooks/                      # Custom hooks
│   ├── useRecordings.ts        # Recordings data & state management
│   └── useRecordingActions.ts  # Recording actions (clone, etc.)
└── utils/                      # Utility functions
    └── formatters.ts           # Format helpers (file size, duration)
```

## Components

### RecordingsPage
Main container that orchestrates all sub-components and manages global state.

**Props:** None (uses internal state and hooks)

**Features:**
- View mode persistence (table/cards)
- Search and filtering
- Real-time updates via SSE
- Video preview modal

### RecordingsTable / RecordingsCards
View-specific containers that render the appropriate layout.

**Props:**
- `jobs`: Array of JobModel
- `recordingStartTimes`: Map of job IDs to start times
- `hasFilters`: Whether filters are active
- `onPreview`: Preview handler
- `onCancel/onDelete/onRetry/onStart/onClone`: Action handlers

### RecordingRow / RecordingCard
Individual recording display components.

**Props:**
- `job`: JobModel
- `startTime`: Recording start time (optional)
- Action handlers (onPreview, onCancel, etc.)

### RecordingThumbnail
Displays recording thumbnail with fallback and status indicators.

**Props:**
- `job`: JobModel
- `onClick`: Click handler (optional)
- `className`: Additional CSS classes
- `showEyeInCorner`: Show eye icon in corner (for cards)

### StatusBadge
Displays job status with appropriate styling.

**Props:**
- `status`: JobModel["status"]
- `className`: Additional CSS classes

### ActionsMenu
Dropdown menu with all available actions for a recording.

**Props:**
- `job`: JobModel
- Action handlers (onCancel, onDelete, etc.)

### RecordingsToolbar
Top toolbar with search, filters, and view toggle.

**Props:**
- `search/onSearchChange`: Search state
- `statusFilter/onStatusFilterChange`: Filter state
- `view/onViewChange`: View mode state
- `recordingsCount`: Number of recordings

### RecordingsEmptyState
Empty state display when no recordings match filters.

**Props:**
- `hasFilters`: Whether filters are active

## Hooks

### useRecordings()
Manages recordings data, real-time updates, and state transitions.

**Returns:**
- `staticJobs`: Completed/failed/cancelled/draft jobs
- `inFlightJobs`: Active/queued jobs
- `allJobs`: Combined array
- `isLoading`: Loading state
- `recordingStartTimesRef`: Ref to start times map
- `handleCancel/handleDelete/handleStart/handleRetry`: Action handlers
- `addJob`: Add new job to list

**Features:**
- Initial data fetch
- SSE subscription for real-time updates
- Polling for new in-flight jobs
- Automatic state transitions
- Start time tracking

### useRecordingActions()
Handles recording actions like cloning.

**Returns:**
- `handleClone`: Clone recording as draft
- `isActionInProgress`: Action loading state

## Utils

### formatters.ts
- `formatFileSize(bytes)`: Format bytes to human-readable size
- `formatDuration(ms)`: Format milliseconds to human-readable duration

## Usage

```tsx
import RecordingsPage from "@/components/RecordingsPage";

// In your page component
export default function Page() {
  return <RecordingsPage />;
}
```

Or import individual components:

```tsx
import { 
  RecordingsTable, 
  useRecordings,
  formatFileSize 
} from "@/components/RecordingsPage";
```

## Future Enhancements

Ready for:
- Sorting functionality
- Bulk actions (select multiple, bulk delete, etc.)
- Advanced filtering
- Export functionality
- Pagination
- Keyboard shortcuts
