# API Reference

## Overview

This document provides a comprehensive reference for all API endpoints in the Social Templates Renderer application.

**Base URL:** `http://localhost:3000/api` (development)

## Authentication

Currently, the API does not require authentication. For production deployments, consider implementing:
- API keys
- JWT tokens
- OAuth 2.0

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Recording Endpoints

### Enqueue Recording

Create a new recording job and add it to the queue.

**Endpoint:** `POST /api/recordings/enqueue`

**Content-Type:** `multipart/form-data`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `template` | string | Yes | Name of the p5.js sketch template |
| `options` | string (JSON) | Yes | Stringified sketch options object |
| `jobId` | string | No | Custom job ID (auto-generated if not provided) |
| `status` | string | No | Initial status: "queued" or "draft" (default: "queued") |
| `file[global][images]` | File | No | Global image asset |
| `file[global][videos]` | File | No | Global video asset |
| `file[slide-N][images]` | File | No | Image asset for slide N |
| `file[slide-N][videos]` | File | No | Video asset for slide N |

**Example Request:**

```javascript
const formData = new FormData()
formData.append('template', 'text-post-with-medias')
formData.append('options', JSON.stringify({
  size: { width: 1080, height: 1350 },
  animation: { framerate: 60, duration: 6 },
  slides: [
    { name: "Intro", content: [...] }
  ]
}))
formData.append('file[global][images]', imageFile)

const response = await fetch('/api/recordings/enqueue', {
  method: 'POST',
  body: formData
})
```

**Response:**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Status Codes:**
- `200`: Job enqueued successfully
- `400`: Invalid request (missing template or options)
- `500`: Internal server error

---

### List Recordings

Get a list of all recording jobs with optional status filtering.

**Endpoint:** `GET /api/recordings`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Comma-separated list of statuses to filter by |

**Valid Status Values:**
- `queued`: Job is waiting in queue
- `active`: Job is currently being processed
- `completed`: Job finished successfully
- `failed`: Job failed with error
- `cancelled`: Job was cancelled by user
- `draft`: Job saved but not started

**Example Request:**

```bash
# Get all jobs
GET /api/recordings

# Get only completed jobs
GET /api/recordings?status=completed

# Get active and queued jobs
GET /api/recordings?status=active,queued
```

**Response:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "template": "text-post-with-medias",
    "status": "completed",
    "progress": 100,
    "resultUrl": "https://s3.../video.mp4",
    "thumbnails": ["https://s3.../thumb-0.jpg"],
    "videoUrls": ["https://s3.../slide-0.mp4"],
    "createdAt": "2025-06-23T10:30:00Z",
    "updatedAt": "2025-06-23T10:35:00Z",
    "options": { ... },
    "snapshotId": "abc-123"
  }
]
```

**Status Codes:**
- `200`: Success
- `500`: Internal server error

---

### Get Recording Details

Get detailed information about a specific recording job.

**Endpoint:** `GET /api/recordings/[id]`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Example Request:**

```bash
GET /api/recordings/550e8400-e29b-41d4-a716-446655440000
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "template": "text-post-with-medias",
  "status": "active",
  "progress": 45,
  "resultUrl": null,
  "thumbnails": null,
  "videoUrls": null,
  "createdAt": "2025-06-23T10:30:00Z",
  "updatedAt": "2025-06-23T10:32:00Z",
  "options": {
    "size": { "width": 1080, "height": 1350 },
    "animation": { "framerate": 60, "duration": 6 }
  },
  "snapshotId": "abc-123"
}
```

**Status Codes:**
- `200`: Success
- `404`: Job not found
- `500`: Internal server error

---

### Start Recording

Start a draft recording job.

**Endpoint:** `POST /api/recordings/[id]/start`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Example Request:**

```bash
POST /api/recordings/550e8400-e29b-41d4-a716-446655440000/start
```

**Response:**

```json
{
  "success": true,
  "message": "Recording started"
}
```

**Status Codes:**
- `200`: Recording started
- `400`: Job is not in draft status
- `404`: Job not found
- `500`: Internal server error

---

### Cancel Recording

Cancel a running or queued recording job.

**Endpoint:** `POST /api/recordings/[id]/cancel`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Example Request:**

```bash
POST /api/recordings/550e8400-e29b-41d4-a716-446655440000/cancel
```

**Response:**

```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

**Status Codes:**
- `200`: Job cancelled
- `404`: Job not found
- `500`: Internal server error

---

### Force Cancel Recording

Force cancel a recording job (removes from queue immediately).

**Endpoint:** `POST /api/recordings/[id]/force-cancel`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Example Request:**

```bash
POST /api/recordings/550e8400-e29b-41d4-a716-446655440000/force-cancel
```

**Response:**

```json
{
  "success": true,
  "message": "Job force cancelled"
}
```

**Status Codes:**
- `200`: Job force cancelled
- `404`: Job not found
- `500`: Internal server error

---

### Retry Recording

Retry a failed recording job.

**Endpoint:** `POST /api/recordings/[id]/retry`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Example Request:**

```bash
POST /api/recordings/550e8400-e29b-41d4-a716-446655440000/retry
```

**Response:**

```json
{
  "success": true,
  "message": "Job retried successfully"
}
```

**Status Codes:**
- `200`: Job retried
- `400`: Job is not in failed status
- `404`: Job not found
- `500`: Internal server error

---

### Get Recording Media

Get media information for a recording job.

**Endpoint:** `GET /api/recordings/[id]/media`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Response:**

```json
{
  "resultUrl": "https://s3.../video.mp4",
  "thumbnails": [
    "https://s3.../thumb-0.jpg",
    "https://s3.../thumb-1.jpg"
  ],
  "videoUrls": [
    "https://s3.../slide-0.mp4",
    "https://s3.../slide-1.mp4"
  ]
}
```

**Status Codes:**
- `200`: Success
- `404`: Job not found or no media available
- `500`: Internal server error

---

### Download Recording

Download the final video for a recording job.

**Endpoint:** `GET /api/recordings/download/[id]`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Response:**

Binary video file (MP4) with appropriate headers for download.

**Status Codes:**
- `200`: Success
- `404`: Job not found or video not available
- `500`: Internal server error

---

### Download Slide Video

Download a specific slide video from a multi-slide recording.

**Endpoint:** `GET /api/recordings/download/[id]/slide/[slideIndex]`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |
| `slideIndex` | number | Zero-based slide index |

**Example Request:**

```bash
GET /api/recordings/download/550e8400-e29b-41d4-a716-446655440000/slide/0
```

**Response:**

Binary video file (MP4) for the specified slide.

**Status Codes:**
- `200`: Success
- `404`: Job, slide, or video not found
- `500`: Internal server error

---

### Download All Slides as ZIP

Download all slide videos as a ZIP archive.

**Endpoint:** `GET /api/recordings/download/[id]/zip`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Example Request:**

```bash
GET /api/recordings/download/550e8400-e29b-41d4-a716-446655440000/zip
```

**Response:**

Binary ZIP file containing all slide videos.

**Status Codes:**
- `200`: Success
- `404`: Job or videos not found
- `500`: Internal server error

---

### Health Check

Check the health status of the recording service.

**Endpoint:** `GET /api/recordings/health`

**Response:**

```json
{
  "status": "healthy",
  "queue": {
    "waiting": 2,
    "active": 1,
    "completed": 150,
    "failed": 3
  },
  "worker": {
    "concurrency": 2,
    "running": true
  }
}
```

**Status Codes:**
- `200`: Service is healthy
- `503`: Service is unhealthy

---

## S3 / Asset Endpoints

### Get Presigned Upload URL

Get a presigned URL for uploading an asset directly to S3.

**Endpoint:** `POST /api/s3/presigned-url`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "fileName": "my-image.jpg",
  "fileType": "image/jpeg",
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "uploadUrl": "https://s3.../presigned-url",
  "fileUrl": "https://s3.../my-image.jpg",
  "expiresIn": 3600
}
```

**Usage:**

```javascript
// 1. Get presigned URL
const { uploadUrl, fileUrl } = await fetch('/api/s3/presigned-url', {
  method: 'POST',
  body: JSON.stringify({ fileName, fileType, jobId })
}).then(r => r.json())

// 2. Upload file directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': fileType }
})

// 3. Use fileUrl in your options
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request
- `500`: Internal server error

---

## Options Endpoints

### Save Template Options

Save or update template options.

**Endpoint:** `POST /api/options/save`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "templateName": "text-post-with-medias",
  "options": {
    "size": { "width": 1080, "height": 1350 },
    "animation": { "framerate": 60, "duration": 6 },
    "slides": [...]
  }
}
```

**Response:**

```json
{
  "success": true,
  "templateId": "abc-123"
}
```

**Status Codes:**
- `200`: Options saved
- `400`: Invalid request
- `500`: Internal server error

---

### Load Template Options

Load saved options for a template.

**Endpoint:** `GET /api/options/load`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | string | Yes | Template name |

**Example Request:**

```bash
GET /api/options/load?template=text-post-with-medias
```

**Response:**

```json
{
  "id": "abc-123",
  "name": "text-post-with-medias",
  "options": {
    "size": { "width": 1080, "height": 1350 },
    "animation": { "framerate": 60, "duration": 6 },
    "slides": [...]
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: Template not found
- `500`: Internal server error

---

## Progression Endpoints

### Get Recording Progress

Get real-time progress information for a recording job.

**Endpoint:** `GET /api/progression/[id]`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Response:**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "progress": 45,
  "currentStep": "recording.encoding-frames",
  "steps": {
    "recording.launching-browser": 100,
    "recording.saving-frames": 100,
    "recording.downloading-frames-archive": 100,
    "recording.extracting-frames-archive": 100,
    "recording.encoding-frames": 45
  }
}
```

**Status Codes:**
- `200`: Success
- `404`: Job not found
- `500`: Internal server error

---

### Stream Recording Progress (SSE)

Stream real-time progress updates using Server-Sent Events.

**Endpoint:** `GET /api/progression/stream/[id]`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Example Usage:**

```javascript
const eventSource = new EventSource(
  `/api/progression/stream/${jobId}`
)

eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data)
  console.log('Progress:', progress)
}

eventSource.onerror = () => {
  eventSource.close()
}
```

**Event Data:**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "progress": 45,
  "currentStep": "recording.encoding-frames",
  "stepProgress": 45
}
```

**Status Codes:**
- `200`: Stream started
- `404`: Job not found

---

## Thumbnail Endpoints

### Get Thumbnail

Get a thumbnail image for a recording job.

**Endpoint:** `GET /api/thumbnails/[id]`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Job ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slide` | number | No | Slide index (for multi-slide recordings) |

**Example Request:**

```bash
# Get first thumbnail
GET /api/thumbnails/550e8400-e29b-41d4-a716-446655440000

# Get thumbnail for slide 2
GET /api/thumbnails/550e8400-e29b-41d4-a716-446655440000?slide=2
```

**Response:**

Binary image file (JPEG) with appropriate headers.

**Status Codes:**
- `200`: Success
- `404`: Thumbnail not found
- `500`: Internal server error

---

## Capture Endpoint

### Capture Frame

Internal endpoint used by the headless browser to report capture progress.

**Endpoint:** `POST /api/capture/progress`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "progress": 45
}
```

**Response:**

```json
{
  "success": true
}
```

**Note:** This endpoint is typically called by the browser during frame capture and not by external clients.

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid input |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error |
| `503` | Service Unavailable |

## Rate Limiting

Currently, there is no rate limiting implemented. For production, consider:
- Per-IP rate limits
- Per-user rate limits (if authentication is added)
- Queue size limits
- Concurrent job limits per user

## Webhooks (Future)

Future versions may support webhooks for job completion:

```json
POST https://your-webhook-url.com/recording-complete
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "resultUrl": "https://s3.../video.mp4",
  "timestamp": "2025-06-23T10:35:00Z"
}
```

## SDK / Client Libraries (Future)

Consider creating client libraries for common languages:
- JavaScript/TypeScript
- Python
- Go
- Ruby

Example TypeScript SDK:

```typescript
import { SocialPipelineClient } from '@social-pipeline/sdk'

const client = new SocialPipelineClient({
  baseUrl: 'http://localhost:3000'
})

// Enqueue recording
const job = await client.recordings.enqueue({
  template: 'text-post-with-medias',
  options: { ... }
})

// Wait for completion
await job.waitForCompletion()

// Download video
await job.download('./output.mp4')
```
