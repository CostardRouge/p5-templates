# Clone Recording with Assets

## Problem
When cloning a recording from the recordings page using "Clone as Draft", the cloned recording was created without the original assets (images/videos). This was because the clone function only copied the options JSON without re-uploading the asset files.

## Solution
Created a new API route `/api/recordings/[id]/clone` that efficiently clones recordings on the server side by:

1. Fetching the original recording from the database
2. Generating a new job ID
3. Copying all S3 objects from the original job folder to the new job folder
4. Updating the options.json with the new job ID
5. Creating a new draft recording in the database

## Implementation Details

### New API Route
- **File**: `src/app/api/recordings/[id]/clone/route.ts`
- **Method**: POST
- **Endpoint**: `/api/recordings/[id]/clone`
- **Response**: `{ success: boolean, jobId?: string, error?: string }`

### Key Features
- **Server-side S3 cloning**: Uses S3 CopyObject to efficiently copy all assets without downloading/re-uploading
- **Preserves folder structure**: Copies entire job folder including `assets/` and `options.json`
- **Updates job ID**: Automatically updates the `options.id` field to the new job ID
- **Creates draft status**: New recording is created as a draft
- **Efficient**: No need to download and re-upload files, just copy within S3

### S3 Folder Structure
```
{jobId}/
  ├── assets/
  │   ├── global/images/{filename}
  │   ├── global/videos/{filename}
  │   ├── slide-0/images/{filename}
  │   └── ...
  └── options.json
```

### Updated Files
1. **src/app/api/recordings/[id]/clone/route.ts** (new)
   - Implements server-side S3 cloning
   - Uses AWS SDK's CopyObjectCommand
   
2. **src/app/recordings/page.tsx** (modified)
   - Updated `handleClone()` to use the new API route
   - Simplified from ~30 lines to ~15 lines

## Usage
From the recordings page, click the "Clone as Draft" button in the actions menu. The recording will be cloned with all its original assets preserved.

## Technical Notes
- Uses AWS SDK's `ListObjectsV2Command` to list all objects in the original job folder
- Uses `CopyObjectCommand` to copy each object to the new job folder
- Maintains public-read ACL on copied objects
- Updates the database with the new job record before copying assets
