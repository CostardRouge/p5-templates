# RecordingsPage Architecture

## Component Hierarchy

```
RecordingsPage (Container)
├── useRecordings() hook
├── useRecordingActions() hook
├── usePersistedViewMode() hook
│
├── RecordingsToolbar
│   ├── Search Input
│   ├── Status Filter Dropdown
│   └── View Toggle (Table/Cards)
│
├── Loading State
│   └── Video Icon + Message
│
├── RecordingsTable (when view === "table")
│   ├── Table Header
│   └── RecordingRow (for each job)
│       ├── RecordingThumbnail
│       ├── Job ID Link
│       ├── Template Link
│       ├── Created Date
│       ├── StatusBadge
│       ├── CompactProgressBar
│       └── ActionsMenu
│           ├── Preview (if completed)
│           ├── Navigation Links
│           ├── DownloadMenuItems
│           │   ├── Individual Videos
│           │   └── ZIP Archive
│           ├── Options JSON Download
│           ├── Actions (Start/Cancel/Retry)
│           ├── Clone
│           └── Delete
│
├── RecordingsCards (when view === "cards")
│   └── RecordingCard (for each job)
│       ├── RecordingThumbnail (with overlay)
│       │   ├── StatusBadge (overlay)
│       │   └── ActionsMenu (overlay)
│       └── Card Content
│           ├── Template Link
│           ├── Job ID Link
│           ├── Metadata (date, duration)
│           └── CompactProgressBar (if active)
│
├── RecordingsEmptyState (when no results)
│   ├── Video Icon
│   └── Message (filtered vs empty)
│
└── VideoPreviewModal (when preview active)
    └── Video Player + Controls
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      RecordingsPage                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              useRecordings Hook                     │    │
│  │                                                     │    │
│  │  1. Initial Fetch (/api/recordings)                │    │
│  │     ↓                                               │    │
│  │  2. Split into staticJobs & inFlightJobs           │    │
│  │     ↓                                               │    │
│  │  3. Subscribe to SSE for inFlightJobs              │    │
│  │     ↓                                               │    │
│  │  4. Poll for new active/queued jobs (5s)           │    │
│  │     ↓                                               │    │
│  │  5. Update progress & status in real-time          │    │
│  │     ↓                                               │    │
│  │  6. Move completed jobs to staticJobs              │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Local State & Filtering                │    │
│  │                                                     │    │
│  │  • allJobs = [...inFlightJobs, ...staticJobs]     │    │
│  │  • Filter by search term                           │    │
│  │  • Filter by status                                │    │
│  │  • Sort (future)                                   │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Render View Component                  │    │
│  │                                                     │    │
│  │  • RecordingsTable (table view)                    │    │
│  │  • RecordingsCards (cards view)                    │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### Global State (useRecordings)
```typescript
{
  staticJobs: JobModel[],           // Completed/failed/cancelled/draft
  inFlightJobs: JobModel[],         // Active/queued
  isLoading: boolean,
  recordingStartTimesRef: Record<string, number>
}
```

### Local State (RecordingsPage)
```typescript
{
  view: "table" | "cards",          // Persisted to localStorage
  search: string,
  statusFilter: string,
  previewJobId: string | null
}
```

### Action State (useRecordingActions)
```typescript
{
  isActionInProgress: boolean
}
```

## Event Flow

### User Actions
```
User clicks "Delete"
    ↓
ActionsMenu.handleAction()
    ↓
API call: DELETE /api/recordings/:id
    ↓
onDelete callback
    ↓
useRecordings.handleDelete()
    ↓
Update staticJobs/inFlightJobs
    ↓
Re-render with updated list
```

### Real-time Updates
```
Recording starts processing
    ↓
SSE event received
    ↓
useMultiRecordingStatusStream callback
    ↓
Update job progress & status
    ↓
If completed: move to staticJobs
    ↓
Re-render with updated progress
```

### Clone Action
```
User clicks "Clone"
    ↓
ActionsMenu calls onClone
    ↓
useRecordingActions.handleClone()
    ↓
1. Fetch options: GET /api/options/download/:id
    ↓
2. Create draft: POST /api/recordings/enqueue
    ↓
3. Fetch new job: GET /api/recordings/:newId
    ↓
4. Return new job
    ↓
RecordingsPage.addJob()
    ↓
Add to staticJobs
    ↓
Re-render with new draft
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/recordings` | GET | Fetch all recordings |
| `/api/recordings?status=queued,active` | GET | Poll for in-flight jobs |
| `/api/recordings/:id` | GET | Fetch single recording |
| `/api/recordings/:id` | DELETE | Delete recording |
| `/api/recordings/:id/start` | POST | Start draft recording |
| `/api/recordings/:id/cancel` | POST | Cancel queued recording |
| `/api/recordings/:id/force-cancel` | POST | Force cancel stale job |
| `/api/recordings/:id/retry` | POST | Retry failed recording |
| `/api/recordings/:id/thumbnail` | GET | Get thumbnail image |
| `/api/recordings/download/:id/slide/:index` | GET | Download video slide |
| `/api/recordings/download/:id/zip` | GET | Download all slides as ZIP |
| `/api/options/download/:id` | GET | Download options JSON |
| `/api/recordings/enqueue` | POST | Create new recording |

## SSE Subscriptions

```
useMultiRecordingStatusStream
    ↓
Subscribe to multiple job IDs
    ↓
Receive events:
{
  jobId: string,
  data: {
    status: string,
    percentage: number,
    recordingDuration?: number,
    steps?: RecordingProgressionSteps
  }
}
    ↓
Update job state in real-time
```

## Performance Considerations

### Optimizations
- **Memoization**: Filter/sort operations can be memoized
- **Virtual scrolling**: Can be added for large lists
- **Lazy loading**: Thumbnails load on demand
- **Code splitting**: Components are tree-shakeable

### Current Behavior
- Initial load: 1 API call
- Polling: Every 5 seconds for active jobs
- SSE: Real-time updates for in-flight jobs
- Thumbnails: Lazy loaded with error fallback

### Future Improvements
- Add pagination for large datasets
- Implement virtual scrolling for table view
- Add request debouncing for search
- Cache thumbnail URLs
- Implement optimistic updates

## Extension Points

### Adding Sorting
1. Add sort state to RecordingsPage
2. Create sort utility in `utils/sorting.ts`
3. Add sort controls to RecordingsToolbar
4. Apply sort to filtered jobs
5. Persist sort preference

### Adding Bulk Actions
1. Add selection state: `Set<string>`
2. Add checkboxes to RecordingRow/Card
3. Create BulkActionsToolbar component
4. Implement bulk operations in hooks
5. Add confirmation dialogs

### Adding Pagination
1. Add pagination state (page, pageSize)
2. Create Pagination component
3. Slice filtered jobs by page
4. Add page controls to toolbar
5. Persist page preference

## Testing Strategy

### Unit Tests
- Test formatters (formatFileSize, formatDuration)
- Test filter logic
- Test sort logic (when added)
- Test action handlers

### Component Tests
- Test RecordingThumbnail fallback
- Test StatusBadge rendering
- Test ActionsMenu options
- Test empty states

### Integration Tests
- Test useRecordings hook
- Test SSE subscriptions
- Test polling behavior
- Test state transitions

### E2E Tests
- Test full user flows
- Test real-time updates
- Test all actions
- Test view switching
