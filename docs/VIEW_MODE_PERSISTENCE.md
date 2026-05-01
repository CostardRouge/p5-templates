# View Mode Persistence

## Overview

The templates and recordings pages now persist the user's view mode preference (grid/list or table/cards) in localStorage. This ensures a consistent experience across page reloads and prevents layout reflow.

## Implementation

### Custom Hook: `usePersistedViewMode`

Located at `src/hooks/usePersistedViewMode.ts`, this hook provides:

- **Hydration Safe**: Prevents React hydration errors by loading from localStorage after mount
- **Minimal Reflow**: Loads persisted value immediately after hydration (single render cycle)
- **Error Handling**: Gracefully handles corrupted data, quota exceeded, and localStorage unavailability
- **Type Safety**: Validates stored values to ensure they match expected view modes
- **SSR Compatible**: Works with Next.js server-side rendering

### Usage

#### Recordings Page

```typescript
const [view, setView] = usePersistedViewMode<"table" | "cards">(
  "recordings-view-mode",
  "table",
);
```

Storage key: `recordings-view-mode`
Default: `table`

#### Templates Page

```typescript
const [view, setView] = usePersistedViewMode<"grid" | "list">(
  "templates-view-mode",
  "grid",
);
```

Storage key: `templates-view-mode`
Default: `grid`

## Features

### 1. Persistent Preference

User's view mode choice is saved to localStorage and restored on page reload.

### 2. Minimal Layout Reflow

The hook loads from localStorage immediately after the component mounts (after hydration), resulting in a single quick update. This prevents hydration errors while keeping the flash to a minimum.

### 3. Error Handling

The implementation handles several error scenarios:

- **Corrupted Data**: If localStorage contains invalid JSON, falls back to default
- **Invalid Values**: If stored value doesn't match expected types, uses default
- **Quota Exceeded**: Logs warning but continues to work with in-memory state
- **localStorage Unavailable**: Works in private browsing or when localStorage is disabled

### 4. Type Safety

The hook validates stored values against the expected union type:

```typescript
type ViewMode = "grid" | "list" | "table" | "cards";
```

If a stored value doesn't match the expected type for that page, it falls back to the default.

## Testing

### Manual Testing

1. **Basic Persistence**
   - Navigate to `/templates`
   - Toggle between grid and list view
   - Refresh the page
   - ✓ View mode should be preserved

2. **Cross-Page Independence**
   - Set templates to list view
   - Set recordings to cards view
   - Navigate between pages
   - ✓ Each page should remember its own preference

3. **Error Recovery**
   - Open browser DevTools → Application → Local Storage
   - Set `templates-view-mode` to invalid value: `"invalid"`
   - Refresh the page
   - ✓ Should fall back to grid view (default)

4. **Private Browsing**
   - Open page in private/incognito mode
   - Toggle view mode
   - ✓ Should work (in-memory only, won't persist across sessions)

### localStorage Keys

- `recordings-view-mode`: Stores "table" or "cards"
- `templates-view-mode`: Stores "grid" or "list"

### Clearing Preferences

To reset to defaults, run in browser console:

```javascript
localStorage.removeItem("recordings-view-mode");
localStorage.removeItem("templates-view-mode");
```

Or clear all:

```javascript
localStorage.p.clear();
```

## Benefits

1. **Better UX**: Users don't have to re-select their preferred view every time
2. **No Flash**: Synchronous initialization prevents layout shift
3. **Robust**: Handles edge cases and errors gracefully
4. **Maintainable**: Centralized logic in a reusable hook
5. **Type-Safe**: Full TypeScript support with proper validation
