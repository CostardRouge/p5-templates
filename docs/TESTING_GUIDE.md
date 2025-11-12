# Testing Guide - Sketch Actions Revamp

## 🧪 Quick Testing Checklist

### Prerequisites
- Backend recording enabled (`BACKEND_RECORDING=true`)
- Server running
- Access to a P5 sketch template

---

## Test Scenarios

### 1️⃣ Fresh Start (No Job)

**Steps:**
1. Navigate to any P5 sketch (e.g., `/templates/p5/your-sketch`)
2. Open render options panel (bottom right)

**Expected:**
- ✅ See "Start Recording" button (blue, primary)
- ✅ See "Save as Draft" button (secondary)
- ✅ See "Browser Recording (.webm)" button

**Test Actions:**
- Click "Start Recording" → Should create job and start recording
- Click "Save as Draft" → Should create draft and redirect with `?id=...`

---

### 2️⃣ Draft Status

**Steps:**
1. Create a draft (from test 1)
2. Make some changes to options
3. Observe the buttons

**Expected:**
- ✅ See "Save" and "Start Recording" side by side
- ✅ See "Delete Draft" button (red text)
- ✅ See "Browser Recording (.webm)" button
- ✅ "Save" button pulses during auto-save (every 10s)

**Test Actions:**
- Click "Save" → Should save changes (watch for pulse animation)
- Wait 10s → Should auto-save (watch for pulse)
- Click "Start Recording" → Should start recording this draft
- Click "Delete Draft" → Should show confirmation, then delete and redirect

---

### 3️⃣ Recording Status (Queued/Active)

**Steps:**
1. Start a recording (from test 1 or 2)
2. Observe during recording

**Expected:**
- ✅ Progress bar shows percentage
- ✅ Status text shows "queued" or "active: step name"
- ✅ P5 sketch is paused (not animating)
- ✅ See "Cancel Recording" button (red text)
- ✅ No other buttons visible

**Test Actions:**
- Observe P5 canvas → Should be frozen/paused
- Click "Cancel Recording" → Should cancel and update status
- Wait for completion → Should transition to completed state

**P5 Pause Test:**
- Open browser console
- Type `window.isLooping()` → Should return `false` during recording
- After recording → Should return `true` (resumed)

---

### 4️⃣ Completed Status

**Steps:**
1. Complete a recording (wait for test 3 to finish)
2. Observe the buttons

**Expected:**
- ✅ See "Preview" button (blue, primary)
- ✅ See "Download" button
- ✅ See "Record Again" button
- ✅ See "Delete" button (red text)
- ✅ See "Browser Recording (.webm)" button

**Test Actions:**
- Click "Preview" → Should open modal with video player
  - Modal should show video(s)
  - Can play/pause video
  - Can close modal
  - Can download from modal
- Click "Download" → Should download video file
- Click "Record Again" → Should create new draft with same options
- Click "Delete" → Should show confirmation, then delete and redirect

---

### 5️⃣ Failed/Cancelled Status

**Steps:**
1. Cancel a recording (from test 3)
   OR trigger a failure (e.g., invalid options)
2. Observe the buttons

**Expected:**
- ✅ See "Retry" button (blue, primary)
- ✅ See "Edit & Save as Draft" button
- ✅ See "Delete" button (red text)
- ✅ See "Browser Recording (.webm)" button

**Test Actions:**
- Click "Retry" → Should restart recording
- Click "Edit & Save as Draft" → Should convert to draft for editing
- Click "Delete" → Should show confirmation, then delete and redirect

---

## 🎨 Visual Tests

### Button Styling
- [ ] Primary buttons have blue background (`bg-blue-600`)
- [ ] Secondary buttons have border only
- [ ] Destructive buttons have red text
- [ ] Hover states work (darker blue, bg-hover, bg-red-50)
- [ ] Disabled buttons are 50% opacity
- [ ] Loading spinners animate smoothly

### Animations
- [ ] "Save" button pulses during auto-save
- [ ] Spinner icons rotate during loading
- [ ] Progress bar fills smoothly
- [ ] Modal opens/closes smoothly

### Icons
- [ ] All icons display correctly
- [ ] Icons align with text
- [ ] Icon sizes are consistent (h-3)

---

## 🔄 State Transitions

Test the full lifecycle:

```
No Job → Draft → Recording → Completed → Delete
   ↓       ↓         ↓            ↓
   ↓    Delete   Cancel      Record Again
   ↓                ↓              ↓
   ↓             Failed         Draft
   ↓                ↓
   ↓             Retry
   ↓                ↓
   └──────────→ Recording
```

**Test Path 1: Happy Path**
1. No Job → Start Recording → Recording → Completed → Preview → Download → Delete

**Test Path 2: Draft Path**
1. No Job → Save as Draft → Edit → Save → Start Recording → Recording → Completed

**Test Path 3: Cancel Path**
1. No Job → Start Recording → Recording → Cancel → Failed → Retry → Recording

**Test Path 4: Delete Path**
1. No Job → Save as Draft → Delete Draft → No Job

---

## 🐛 Edge Cases

### Test 1: Rapid Clicks
- Click "Start Recording" multiple times quickly
- **Expected:** Should only create one job (disabled state prevents duplicates)

### Test 2: Network Errors
- Disconnect network
- Try to save/record
- **Expected:** Should show error alert

### Test 3: Browser Refresh
- Create draft
- Refresh page
- **Expected:** Should load draft with correct buttons

### Test 4: Multiple Tabs
- Open same draft in two tabs
- Edit in one tab
- **Expected:** Changes in one tab don't affect the other (until refresh)

### Test 5: Long Recording
- Start a long recording (many slides)
- **Expected:** Progress updates smoothly, can cancel anytime

### Test 6: No Video URLs (Old Recordings)
- Load an old recording without videoUrls
- **Expected:** Preview button should still work or gracefully handle missing data

---

## 📱 Responsive Tests

### Desktop
- [ ] Buttons fit in panel
- [ ] Text is readable
- [ ] Icons are visible
- [ ] Modal is centered

### Tablet
- [ ] Panel doesn't overflow
- [ ] Buttons stack properly
- [ ] Modal is responsive

### Mobile
- [ ] Panel is accessible
- [ ] Buttons are tappable
- [ ] Modal fits screen

---

## ♿ Accessibility Tests

### Keyboard Navigation
- [ ] Can tab through buttons
- [ ] Can activate with Enter/Space
- [ ] Focus visible on buttons
- [ ] Modal can be closed with Escape

### Screen Reader
- [ ] Button labels are descriptive
- [ ] Loading states announced
- [ ] Modal has proper ARIA labels
- [ ] Confirmation dialogs are accessible

---

## 🎯 Performance Tests

### P5 Pause
1. Open browser DevTools → Performance tab
2. Start recording
3. **Expected:** CPU usage drops when sketch pauses

### Auto-Save
1. Make changes to draft
2. Wait 10 seconds
3. **Expected:** Saves without blocking UI

### Modal Loading
1. Click "Preview" on completed recording
2. **Expected:** Modal opens quickly, video loads progressively

---

## ✅ Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ No TypeScript errors
- ✅ Smooth animations
- ✅ Clear user feedback
- ✅ Logical button states
- ✅ Consistent with recording page

---

## 🚨 Known Issues to Watch For

### Issue 1: P5 Pause Not Working
**Symptom:** Sketch keeps animating during recording
**Check:** Console for `window.noLoop is not a function`
**Fix:** Ensure P5 sketch is loaded before recording starts

### Issue 2: Preview Modal Empty
**Symptom:** Modal opens but no video
**Check:** Network tab for `/api/recordings/:id/media` response
**Fix:** Ensure recording has `videoUrls` in database

### Issue 3: Auto-Save Not Triggering
**Symptom:** No pulse animation after 10s
**Check:** Console for errors in `useInterval` hook
**Fix:** Ensure `jobId` exists and status is "draft"

### Issue 4: Delete Confirmation Not Showing
**Symptom:** Deletes without confirmation
**Check:** Browser settings for blocking dialogs
**Fix:** Ensure `confirm()` is not blocked

---

## 📊 Test Results Template

```
Date: ___________
Tester: ___________
Browser: ___________
OS: ___________

[ ] Test 1: Fresh Start
[ ] Test 2: Draft Status
[ ] Test 3: Recording Status
[ ] Test 4: Completed Status
[ ] Test 5: Failed/Cancelled Status
[ ] Visual Tests
[ ] State Transitions
[ ] Edge Cases
[ ] Responsive Tests
[ ] Accessibility Tests
[ ] Performance Tests

Notes:
_________________________________
_________________________________
_________________________________

Issues Found:
_________________________________
_________________________________
_________________________________
```

---

## 🎉 Quick Smoke Test (5 minutes)

If you're short on time, run this quick test:

1. **Fresh Start** → Click "Start Recording"
2. **Recording** → Verify P5 pauses, progress shows
3. **Completed** → Click "Preview", verify modal opens
4. **Download** → Click "Download", verify file downloads
5. **Delete** → Click "Delete", verify confirmation and deletion

If all 5 steps work, the implementation is solid! ✅
