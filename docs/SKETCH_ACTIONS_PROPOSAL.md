# Sketch Page Actions Revamp - Proposal

## Current Problems
1. **Confusing action buttons** - Multiple "Save", "Record", "Save as draft" buttons with unclear purposes
2. **Illogical status lifecycle** - Actions don't match the natural workflow
3. **Inconsistent with recording page** - Different UX patterns between pages
4. **Missing preview modal** - No way to preview completed recordings from sketch page
5. **P5 sketch keeps running during recording** - Should pause like in P5Controls

## Proposed Solution: Simple & Startup-Like

### Core Principle
**Match the recording page UX** - Same actions, same flow, same simplicity.

---

## Status Lifecycle & Actions

### 1. **No Job (Fresh Start)**
**Available Actions:**
- 🎬 **Start Recording** → Creates draft + starts recording immediately
- 💾 **Save as Draft** → Creates draft without recording

**Behavior:**
- Clean slate, no confusion
- Two clear paths: record now or save for later

---

### 2. **Draft Status**
**Available Actions:**
- 💾 **Save** → Updates existing draft (auto-saves every 10s)
- 🎬 **Start Recording** → Begins recording this draft
- 🗑️ **Delete Draft** → Removes draft (with confirmation)

**Behavior:**
- Auto-save indicator shows when saving
- Can edit freely before recording
- Clear path to start recording

---

### 3. **Queued/Active Status**
**Available Actions:**
- ⏸️ **Pause P5 Sketch** → Pauses the sketch during recording
- ❌ **Cancel Recording** → Stops the recording process
- 🔄 **Force Cancel** (if stale > 1hr) → Emergency cancel

**Behavior:**
- P5 sketch automatically pauses when recording starts
- Progress bar shows recording status
- Can cancel if needed

---

### 4. **Completed Status**
**Available Actions:**
- 👁️ **Preview** → Opens preview modal (like recording page)
- 💾 **Download** → Downloads video(s)
- 🔄 **Record Again** → Creates new draft from this config
- 🗑️ **Delete** → Removes recording

**Behavior:**
- Preview modal shows video player
- Can download individual slides or zip
- Easy to create variations

---

### 5. **Failed/Cancelled Status**
**Available Actions:**
- 🔄 **Retry** → Attempts recording again
- 🗑️ **Delete** → Removes failed job
- 📝 **Edit & Save as Draft** → Modify and save

**Behavior:**
- Clear recovery path
- Can fix issues and retry
- No dead ends

---

## UI Layout

```
┌─────────────────────────────────────────┐
│  Sketch Canvas                          │
│                                         │
│  [P5 Controls: GitHub | Pause | Save]  │
│                                         │
│                                         │
│                          ┌──────────────┤
│                          │ Render Opts  │
│                          ├──────────────┤
│                          │ • Settings   │
│                          │ • Content    │
│                          │ • Slides     │
│                          ├──────────────┤
│                          │ ACTIONS:     │
│                          │              │
│                          │ [Action 1]   │
│                          │ [Action 2]   │
│                          │              │
│                          │ [Browser Rec]│
│                          └──────────────┘
```

---

## Action Button Specifications

### Visual States
- **Primary Action**: Blue background, prominent
- **Secondary Action**: Border only, subtle
- **Destructive Action**: Red text/border
- **Disabled**: 50% opacity, no interaction
- **Loading**: Spinner icon, pulse animation

### Button Layout
```tsx
// No Job
<div className="flex flex-col gap-1">
  <button className="primary">🎬 Start Recording</button>
  <button className="secondary">💾 Save as Draft</button>
  <button className="secondary">💾 Browser Recording (.webm)</button>
</div>

// Draft
<div className="flex flex-col gap-1">
  <div className="flex gap-1">
    <button className="secondary">💾 Save</button>
    <button className="primary">🎬 Start Recording</button>
  </div>
  <button className="destructive">🗑️ Delete Draft</button>
  <button className="secondary">💾 Browser Recording (.webm)</button>
</div>

// Recording (Queued/Active)
<div className="flex flex-col gap-1">
  <ProgressBar percentage={progress} status={status} />
  <button className="destructive">❌ Cancel</button>
</div>

// Completed
<div className="flex flex-col gap-1">
  <button className="primary">👁️ Preview</button>
  <button className="secondary">💾 Download</button>
  <button className="secondary">🔄 Record Again</button>
  <button className="destructive">🗑️ Delete</button>
  <button className="secondary">💾 Browser Recording (.webm)</button>
</div>

// Failed/Cancelled
<div className="flex flex-col gap-1">
  <button className="primary">🔄 Retry</button>
  <button className="secondary">📝 Edit & Save as Draft</button>
  <button className="destructive">🗑️ Delete</button>
  <button className="secondary">💾 Browser Recording (.webm)</button>
</div>
```

---

## P5 Sketch Pause During Recording

### Implementation (from P5Controls.tsx)
```tsx
// When recording starts (status: queued/active)
useEffect(() => {
  if (recordingStatus === 'queued' || recordingStatus === 'active') {
    // Pause the sketch
    if (window?.noLoop) {
      window.noLoop();
    }
  } else {
    // Resume when not recording
    if (window?.loop) {
      window.loop();
    }
  }
}, [recordingStatus]);
```

**Why?**
- Prevents interference with server-side recording
- Saves CPU/GPU resources
- Consistent with P5Controls pause behavior
- Auto-resumes when recording completes

---

## Preview Modal Integration

### Features (from recording page)
- Video player with controls
- Slide navigation (if multiple slides)
- Download options
- Close button
- Responsive design

### Trigger
- "Preview" button appears when status is "completed"
- Opens modal with video URLs from job data
- Same component as recording page (`VideoPreviewModal`)

---

## Key Improvements

### 1. **Clarity**
- One primary action per state
- Clear button labels
- No ambiguous options

### 2. **Consistency**
- Matches recording page exactly
- Same icons, same wording
- Predictable behavior

### 3. **Simplicity**
- Fewer buttons at once
- Logical progression
- No dead ends

### 4. **Feedback**
- Auto-save indicator
- Progress bars
- Loading states
- Success/error messages

### 5. **Safety**
- Confirmation for destructive actions
- Auto-save prevents data loss
- Can always recover from failures

---

## Migration Notes

### Breaking Changes
- None - purely UI/UX improvements
- Backend API remains the same
- Existing recordings unaffected

### Testing Checklist
- [ ] Fresh start → Save as draft
- [ ] Fresh start → Start recording
- [ ] Draft → Edit → Save
- [ ] Draft → Start recording
- [ ] Recording → Cancel
- [ ] Recording → Complete → Preview
- [ ] Completed → Download
- [ ] Completed → Record again
- [ ] Failed → Retry
- [ ] P5 sketch pauses during recording
- [ ] Auto-save works (10s interval)
- [ ] Unsaved changes modal works

---

## Implementation Priority

### Phase 1: Core Actions (High Priority)
1. Simplify action buttons based on status
2. Add preview modal integration
3. Implement P5 pause during recording

### Phase 2: Polish (Medium Priority)
4. Add delete confirmation
5. Improve loading states
6. Add success/error toasts

### Phase 3: Nice-to-Have (Low Priority)
7. Keyboard shortcuts
8. Action history/undo
9. Batch operations

---

## Comparison: Before vs After

### Before (Current)
```
No Job:
- Save as draft
- Record new video
- Browser recording

Draft:
- Save
- Save as draft (?)
- Record this draft
- Record new video (?)
- Browser recording
```
**Problems:** Confusing, redundant, unclear

### After (Proposed)
```
No Job:
- Start Recording
- Save as Draft
- Browser recording

Draft:
- Save | Start Recording
- Delete Draft
- Browser recording
```
**Benefits:** Clear, simple, logical

---

## Questions & Answers

**Q: Why remove "Record new video" from draft state?**
A: It's redundant. If you want a new recording, just edit the draft or create a new one.

**Q: What about browser recording?**
A: Always available as a fallback option, but secondary to server recording.

**Q: Should we show recording progress in the sketch?**
A: Yes, replace action buttons with progress bar during recording.

**Q: What if user closes tab during recording?**
A: Recording continues on server. They can check status in recordings page.

---

## Conclusion

This proposal simplifies the sketch page actions to match the recording page UX, making it intuitive and startup-friendly. The key is **one clear action per state** with logical progression through the lifecycle.

**Next Steps:**
1. Review and approve proposal
2. Implement Phase 1 changes
3. Test thoroughly
4. Deploy and gather feedback
