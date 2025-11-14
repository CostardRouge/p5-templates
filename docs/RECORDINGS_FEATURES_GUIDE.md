# Recordings Page - Features Guide

## Quick Reference

### Sorting

**Location:** Toolbar (top right)

**How to use:**
1. Click the "Sort: [Field]" dropdown
2. Select your preferred sort field
3. Click the arrow button to toggle ascending/descending
4. Your preference is saved automatically

**Available sorts:**
- Created Date (newest/oldest first)
- Updated Date (most/least recently updated)
- Status (active → queued → draft → completed → failed → cancelled)
- Template (A-Z or Z-A)
- Duration (longest/shortest recordings)
- ID (A-Z or Z-A)

### Bulk Actions

**Location:** Floating toolbar (bottom center, appears when items selected)

**How to use:**

#### Table View
1. Check the box in the table header to select all
2. Or check individual boxes in each row
3. Floating toolbar appears showing count
4. Click desired action button
5. Confirm if prompted

#### Card View
1. Check the box in top-left of each card
2. Floating toolbar appears showing count
3. Click desired action button
4. Confirm if prompted

**Available actions:**
- **Delete**: Remove selected recordings (completed/cancelled/draft/failed only)
- **Cancel**: Cancel selected recordings (queued only)
- **Retry**: Retry selected recordings (failed/cancelled only)

**Notes:**
- Actions only appear when applicable to selection
- Confirmation required for destructive actions
- All actions run in parallel for speed
- Selection clears after successful action

## Keyboard Shortcuts

Coming soon:
- `Cmd/Ctrl + A`: Select all
- `Delete/Backspace`: Bulk delete selected
- `Escape`: Clear selection

## Tips & Tricks

### Efficient Workflows

**Delete old recordings:**
1. Sort by "Created Date" (oldest first)
2. Select all with header checkbox
3. Click "Delete"
4. Confirm

**Retry all failed recordings:**
1. Filter by "Failed" status
2. Select all
3. Click "Retry"

**Find specific recording:**
1. Use search box (searches ID and template)
2. Sort by relevant field
3. Switch to table view for detailed info

### Power User Features

**Multi-criteria filtering:**
- Combine search + status filter + sort
- Example: Search "neon" + Filter "completed" + Sort by "duration"

**Bulk operations:**
- Select across multiple pages (coming soon)
- Export selected as CSV (coming soon)
- Download selected as ZIP (coming soon)

## Visual Guide

### Sorting UI

```
┌─────────────────────────────────────────────────────────┐
│ Recordings                                    [Search] │
│ 42 recordings • completed                               │
│                                                         │
│ [Status Filter ▼] [Sort: Created Date ▼] [↓] [⊞][≡]  │
│                                            └─ Toggle    │
│                                                order    │
└─────────────────────────────────────────────────────────┘
```

### Bulk Actions Toolbar

```
                    ┌─────────────────────────────────────┐
                    │ ✓ 5 selected │ Cancel │ Delete │ ✕ │
                    └─────────────────────────────────────┘
                              ↑ Appears at bottom
```

### Table View with Selection

```
┌───┬─────────┬────────┬──────────┬─────────┬────────┬──────────┬─────────┐
│ ☑ │ Preview │   ID   │ Template │ Created │ Status │ Progress │ Actions │
├───┼─────────┼────────┼──────────┼─────────┼────────┼──────────┼─────────┤
│ ☑ │  [img]  │ #abc12 │  neon    │ Nov 14  │ ✓ Done │   100%   │   ⋮    │
│ ☐ │  [img]  │ #def34 │  retro   │ Nov 13  │ ⚠ Fail │    0%    │   ⋮    │
│ ☑ │  [img]  │ #ghi56 │  neon    │ Nov 12  │ ✓ Done │   100%   │   ⋮    │
└───┴─────────┴────────┴──────────┴─────────┴────────┴──────────┴─────────┘
```

### Card View with Selection

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ☑     [✓]   │  │ ☐     [⚠]   │  │ ☑     [✓]   │
│             │  │             │  │             │
│   [Image]   │  │   [Image]   │  │   [Image]   │
│             │  │             │  │             │
│ neon        │  │ retro       │  │ neon        │
│ #abc12      │  │ #def34      │  │ #ghi56      │
│ Nov 14      │  │ Nov 13      │  │ Nov 12      │
└─────────────┘  └─────────────┘  └─────────────┘
```

## Common Questions

**Q: Can I sort by multiple fields?**
A: Not yet, but it's planned for a future update.

**Q: Can I select recordings across different pages?**
A: Pagination isn't implemented yet, but when it is, yes!

**Q: What happens if a bulk action fails for some items?**
A: Each item is processed independently. Successful items are updated, failed items remain unchanged. Check the console for error details.

**Q: Can I undo a bulk delete?**
A: Not yet, which is why we show a confirmation dialog. Undo is planned for a future update.

**Q: Does selection persist when I change filters?**
A: Yes! Your selection is maintained even when filtering or sorting.

**Q: Can I bulk download recordings?**
A: Not yet, but it's planned. For now, use the individual download options in the actions menu.

## Troubleshooting

**Toolbar doesn't appear:**
- Make sure you've selected at least one recording
- Check that you're not in loading state
- Try refreshing the page

**Sort doesn't work:**
- Check that you have recordings to sort
- Try changing the sort field
- Clear your browser cache if needed

**Bulk action fails:**
- Check your network connection
- Verify you have permission to perform the action
- Check browser console for error details
- Try the action on individual items first

**Selection gets cleared:**
- This is expected after successful bulk actions
- Click "Clear selection" (X) to manually clear
- Refresh the page to reset everything

## Best Practices

1. **Use filters before bulk actions** - Narrow down your selection first
2. **Sort before selecting** - Makes it easier to select the right items
3. **Double-check before deleting** - Deletions cannot be undone
4. **Use table view for details** - Better for reviewing before bulk actions
5. **Use card view for visual browsing** - Better for finding recordings by thumbnail

## Feedback

Found a bug or have a feature request? Please let us know!
