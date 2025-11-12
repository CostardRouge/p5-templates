# Quick Reference - Sketch Actions

## 🎯 Status → Actions Map

```
┌─────────────────┬──────────────────────────────────────┐
│ Status          │ Available Actions                    │
├─────────────────┼──────────────────────────────────────┤
│ No Job          │ • Start Recording (primary)          │
│                 │ • Save as Draft                      │
│                 │ • Browser Recording                  │
├─────────────────┼──────────────────────────────────────┤
│ Draft           │ • Save + Start Recording (side by)   │
│                 │ • Delete Draft                       │
│                 │ • Browser Recording                  │
├─────────────────┼──────────────────────────────────────┤
│ Recording       │ • Progress Bar                       │
│ (Queued/Active) │ • Cancel Recording                   │
│                 │ • P5 Sketch Paused                   │
├─────────────────┼──────────────────────────────────────┤
│ Completed       │ • Preview (primary)                  │
│                 │ • Download                           │
│                 │ • Record Again                       │
│                 │ • Delete                             │
│                 │ • Browser Recording                  │
├─────────────────┼──────────────────────────────────────┤
│ Failed/         │ • Retry (primary)                    │
│ Cancelled       │ • Edit & Save as Draft               │
│                 │ • Delete                             │
│                 │ • Browser Recording                  │
└─────────────────┴──────────────────────────────────────┘
```

---

## 🎨 Button Styles Quick Reference

```tsx
// Primary Action (Blue)
className="rounded-lg px-2 py-1 border border-theme bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xs font-medium"

// Secondary Action
className="rounded-lg px-2 py-1 border border-theme text-foreground bg-background hover:bg-hover disabled:opacity-50 text-xs"

// Destructive Action (Red)
className="rounded-lg px-2 py-1 border border-theme text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs"

// Loading State
className={clsx("...", { "animate-pulse-soft": saving })}
```

---

## 🔧 Key Functions

```tsx
// Submit recording/draft
handleSubmit(status: "queued" | "draft", jobId?, skipRedirect?)

// Delete recording/draft
handleDelete() // Shows confirmation

// Cancel active recording
handleCancel()

// Retry failed recording
handleRetry()

// Create new draft from completed
handleRecordAgain()
```

---

## 🎬 P5 Pause Logic

```tsx
useEffect(() => {
  const isRecording = recordingProgress && 
    ["queued", "active"].includes(recordingProgress.status);
  
  if (isRecording) {
    (window as any).noLoop(); // Pause
  } else {
    (window as any).loop();   // Resume
  }
}, [recordingProgress]);
```

---

## 📊 Status Detection

```tsx
const currentStatus = recordingProgress?.status || persistedJob?.status;
const isRecording = recordingProgress && ["queued", "active"].includes(recordingProgress.status);
const isCompleted = currentStatus === "completed";
const isFailed = ["failed", "cancelled"].includes(currentStatus || "");
const isDraft = currentStatus === "draft";
const hasNoJob = !persistedJob && !recordingProgress;
```

---

## 🎯 Icons Used

```tsx
import {
  Archive,      // Save as Draft
  Clapperboard, // Start Recording
  Download,     // Download
  Eye,          // Preview
  Loader,       // Loading spinner
  RotateCcw,    // Retry / Record Again
  Save,         // Save / Browser Recording
  Trash2,       // Delete
  X             // Cancel
} from "lucide-react";
```

---

## 🔗 API Endpoints

```
POST   /api/recordings/:id/cancel       → Cancel recording
POST   /api/recordings/:id/retry        → Retry failed
DELETE /api/recordings/:id              → Delete recording
GET    /api/recordings/:id/media        → Get video URLs
GET    /api/recordings/download/:id/... → Download video
```

---

## ⚡ Quick Test Commands

```bash
# Check TypeScript errors
npm run type-check

# Run dev server
npm run dev

# Build for production
npm run build

# Run tests (if available)
npm test
```

---

## 🐛 Debug Checklist

```
□ Check browser console for errors
□ Check network tab for failed API calls
□ Verify BACKEND_RECORDING=true
□ Verify P5 sketch is loaded
□ Check job status in database
□ Verify videoUrls exist for preview
□ Test in incognito mode
□ Clear browser cache
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile first */
.button { /* base styles */ }

/* Tablet */
@media (min-width: 640px) { /* sm */ }

/* Desktop */
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
```

---

## 🎨 Theme Variables

```css
--background: /* white (light) / black (dark) */
--foreground: /* black (light) / white (dark) */
--border: /* gray-300 (light) / gray-800 (dark) */
--hover: /* gray-100 (light) / gray-900 (dark) */
```

---

## 🔄 State Flow Diagram

```
    ┌─────────┐
    │ No Job  │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────┐
│ Draft │ │Recording │
└───┬───┘ └────┬─────┘
    │          │
    │     ┌────┴────┐
    │     │         │
    │     ▼         ▼
    │ ┌─────────┐ ┌────────┐
    └─►Completed│ │ Failed │
      └─────────┘ └────────┘
```

---

## 💡 Pro Tips

1. **Auto-save**: Happens every 10s for drafts
2. **P5 Pause**: Automatic during recording
3. **Preview**: Only for recordings with videoUrls
4. **Delete**: Always shows confirmation
5. **Browser Recording**: Always available (except during server recording)

---

## 🚨 Common Pitfalls

❌ **Don't** call `handleSubmit()` without status
✅ **Do** call `handleSubmit("queued")` or `handleSubmit("draft")`

❌ **Don't** forget to check `persistedJob` exists
✅ **Do** use `persistedJob?.id` with optional chaining

❌ **Don't** show preview for old recordings without videoUrls
✅ **Do** check `job.videoUrls` exists before showing preview

❌ **Don't** forget loading/disabled states
✅ **Do** disable buttons during operations

---

## 📚 Related Files

```
src/components/ClientProcessingSketch/
├── ClientProcessingSketch.tsx
├── components/
│   ├── P5Controls.tsx
│   ├── TemplateOptions/
│   │   ├── TemplateOptions.tsx
│   │   └── components/
│   │       └── CaptureActions.tsx ← Main file
│   └── SketchProvider/
│       └── hooks/
│           └── useSketch.ts
└── ...

src/components/
└── VideoPreviewModal.tsx ← Preview modal

src/app/
└── globals.css ← Animations
```

---

## 🎯 One-Liner Summary

**Status-based action buttons with P5 pause, preview modal, and clear visual hierarchy.**

---

**Last Updated:** November 11, 2025
