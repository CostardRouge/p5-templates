# RecordingsPage - Quick Start

## Import & Use

```tsx
import RecordingsPage from "@/components/RecordingsPage";

export default function Page() {
  return <RecordingsPage />;
}
```

That's it! Everything is self-contained.

## Features at a Glance

### Sorting
- **Dropdown**: Select field (Created, Updated, Status, Template, Duration, ID)
- **Button**: Toggle order (↑ ascending, ↓ descending)
- **Auto-saved**: Preference persists

### Bulk Actions
- **Select**: Check boxes in table/cards
- **Actions**: Delete, Cancel, Retry (appears at bottom)
- **Safe**: Confirmations for destructive actions

### Views
- **Table**: Detailed view with sortable columns
- **Cards**: Visual grid view
- **Toggle**: Switch between views (top right)

### Search & Filter
- **Search**: By ID or template name
- **Filter**: By status (dropdown)
- **Combine**: Use together for precision

## Component Structure

```
RecordingsPage/
├── components/     # 12 UI components
├── hooks/          # 4 custom hooks
└── utils/          # Formatters
```

## Key Hooks

```tsx
// Data management
const { allJobs, isLoading, handleDelete, ... } = useRecordings();

// Sorting
const sorted = useSorting(jobs, { field: "createdAt", order: "desc" });

// Bulk actions
const { selectedIds, bulkDelete, ... } = useBulkActions();

// Persistence
const [sortConfig, setSortConfig] = usePersistedSort("key", defaultValue);
```

## Customization

### Add new sort field
1. Add to `SortField` type in `hooks/useSorting.ts`
2. Add case in `useSorting` switch statement
3. Add option in `SortControls.tsx`

### Add new bulk action
1. Add handler in `hooks/useBulkActions.ts`
2. Add button in `BulkActionsToolbar.tsx`
3. Wire up in `RecordingsPage.tsx`

### Add new view
1. Create view component (e.g., `RecordingsGrid.tsx`)
2. Add to view toggle in `RecordingsToolbar.tsx`
3. Add conditional render in `RecordingsPage.tsx`

## Performance Tips

- Sorting is memoized (only re-runs when needed)
- Selection uses Set (O(1) lookups)
- Bulk actions run in parallel
- Thumbnails lazy load

## Common Patterns

### Filter then sort
```tsx
const filtered = jobs.filter(/* ... */);
const sorted = useSorting(filtered, sortConfig);
```

### Select all filtered
```tsx
<button onClick={() => selectAll(filtered)}>
  Select All
</button>
```

### Conditional bulk actions
```tsx
const canDelete = selectedJobs.some(j => 
  ["completed", "cancelled", "draft", "failed"].includes(j.status)
);
```

## Troubleshooting

**Issue**: Checkboxes don't work
**Fix**: Ensure `selectedIds` and `onToggleSelection` are passed down

**Issue**: Sort doesn't persist
**Fix**: Check localStorage is enabled and key is unique

**Issue**: Bulk action fails silently
**Fix**: Check browser console for errors, verify API endpoints

## Documentation

- **README.md**: Component overview
- **ARCHITECTURE.md**: Technical deep dive
- **QUICK_START.md**: This file
- **../../docs/**: User guides and specs

## Support

Questions? Check the docs or review the code - it's well-commented!
