# Options Import/Export Feature

This document describes the options.json import and export functionality that allows you to transfer recording configurations between different server instances.

## Overview

The options import/export feature enables you to:
1. Download options.json from any sketch page (persisted or not)
2. Download options.json from the recordings page
3. Import options.json into existing jobs with specific statuses

This is particularly useful when you have multiple deployment environments (e.g., local dev, Vercel instance without recording, NAS with recording enabled) and want to transfer configurations between them.

## Download Options.json

### From Sketch Page

A "Download Options" button is always visible in the sketch page's capture actions panel. This button:
- Works for both persisted and non-persisted templates
- Downloads the current form data as options.json
- Uses browser-side download (no server interaction needed)
- Includes all current form values and settings
- Filename format: `options-{jobId}.json` or `options-{sketchName}-{timestamp}.json`

**Location**: Sketch page → Capture Actions panel → "Download Options" button

### From Recordings Page

You can download options.json from the recordings page actions menu:
- Click the menu icon (three dots) on any recording
- Select "Download" → "Options JSON"
- Downloads the persisted options.json from S3

**Location**: Recordings page → Recording row → Actions menu → Download → Options JSON

## Import Options.json

### Allowed Job Statuses

You can only import options.json into jobs with the following statuses:
- **draft** - Jobs that haven't been started yet
- **failed** - Jobs that failed during recording
- **cancelled** - Jobs that were cancelled

Jobs with these statuses **cannot** be updated:
- **queued** - Currently in the queue
- **active** - Currently recording
- **completed** - Successfully completed recordings

### Import Behavior

When importing options.json:
- ✅ All configuration options are imported
- ✅ Form values are updated
- ✅ Animation settings are preserved
- ❌ **Assets are ignored** (too complex to handle)
- ✅ Job ID is preserved (not overwritten)
- ✅ Progress is reset to 0 for failed/cancelled jobs

### From Sketch Page

If you have a persisted job with an allowed status, an "Import Options" button appears:

**Steps**:
1. Open the sketch page with a job ID (e.g., `?id=abc123`)
2. Ensure the job status is draft, failed, or cancelled
3. Click "Import Options" button
4. Select your options.json file
5. Page will refresh automatically after successful import

**Location**: Sketch page → Capture Actions panel → "Import Options" button

### From Recordings Page

You can also import from the recordings page actions menu:

**Steps**:
1. Go to the recordings page
2. Find a recording with status: draft, failed, or cancelled
3. Click the actions menu (three dots)
4. Select "Import" → "Import Options JSON"
5. Select your options.json file
6. Page will refresh automatically after successful import

**Location**: Recordings page → Recording row → Actions menu → Import → Import Options JSON

## Use Case Example

### Scenario: Transfer from Vercel to NAS

1. **On Vercel (no recording enabled)**:
   - Create and configure your sketch
   - Click "Download Options" to get options.json
   
2. **On NAS (recording enabled)**:
   - Create a draft recording or use a failed/cancelled one
   - Click "Import Options" and select the downloaded options.json
   - Start the recording with the imported configuration

## API Endpoints

### Download Options
```
GET /api/options/download/[id]
```
Downloads the options.json file from S3 for a given job ID.

### Import Options
```
POST /api/options/import/[id]
```
Imports options.json into an existing job. Requires:
- Job status must be draft, failed, or cancelled
- FormData with a "file" field containing the options.json

**Request**:
```typescript
const formData = new FormData();
formData.append("file", optionsJsonFile);

fetch(`/api/options/import/${jobId}`, {
  method: "POST",
  body: formData
});
```

**Response**:
```json
{
  "success": true,
  "jobId": "abc123"
}
```

**Error Response**:
```json
{
  "error": "Cannot import options for job with status: completed. Only draft, failed, and cancelled jobs can be updated."
}
```

## Limitations

1. **Assets are not imported** - Images, videos, and other assets referenced in the options.json are not transferred. You'll need to re-upload assets manually.

2. **Status restrictions** - You cannot import into active, queued, or completed jobs to prevent data corruption.

3. **Job ID preservation** - The imported options will keep the target job's ID, not the source job's ID.

## Technical Details

### File Structure

The downloaded options.json contains:
```json
{
  "id": "job-id",
  "name": "sketch-name",
  "sketch": { /* form values */ },
  "slides": [ /* slide configurations */ ],
  "assets": { /* asset references - ignored on import */ },
  "duration": 5000,
  "fps": 30,
  // ... other options
}
```

### Import Process

1. Validate job exists and has allowed status
2. Parse uploaded JSON file
3. Remove assets from imported options
4. Preserve target job ID
5. Update job in database
6. Reset progress if needed
7. Return success response

## Future Enhancements

Potential improvements for future versions:
- Asset transfer support with S3 copy operations
- Batch import for multiple jobs
- Import preview before applying changes
- Partial import (select which fields to import)
- Import history/audit log
