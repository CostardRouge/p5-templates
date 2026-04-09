# Architecture Documentation

## Overview

Social Templates Renderer is a full-stack application that enables the creation, parameterization, and rendering of p5.js sketches into video format. The system is designed to support automated video generation from creative coding sketches with a focus on scalability and maintainability.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Template List  │  │ Sketch Editor│  │ Recording Queue │ │
│  │    Gallery     │  │  & Preview   │  │    Dashboard    │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                       │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │   API Routes   │  │  SSR Pages   │  │  Static Assets  │ │
│  │  /api/...      │  │  /           │  │  /public        │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Postgres │  │  Redis   │  │  MinIO   │
        │   (DB)   │  │ (Queue)  │  │  (S3)    │
        └──────────┘  └──────────┘  └──────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  BullMQ Worker   │
                    │  (Rendering)     │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Playwright     │
                    │  (Headless)      │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │     FFmpeg       │
                    │  (Encoding)      │
                    └──────────────────┘
```

## Core Components

### 1. Frontend Layer

#### Template Gallery (`/`)
- Lists all available p5.js sketches
- Shows preview thumbnails
- Provides navigation to individual sketch editors

#### Sketch Editor (`//[sketchName]`)
- **Dynamic Form Generation**: Forms are automatically generated from Zod schemas
- **Live Preview**: Real-time p5.js sketch rendering with parameter updates
- **Asset Management**: Drag-and-drop image/video uploads
- **Content Items System**: Modular content system supporting:
  - Background (solid colors, patterns)
  - Meta (corner text, slide progression)
  - Text (with positioning, fonts, colors)
  - Image (single image with animations)
  - Images Stack (multiple images with effects)
  - Visual (custom visual effects like neon-graffiti)

#### Recording Dashboard (`/recordings`)
- Real-time job status monitoring
- Progress tracking with detailed steps
- Download links for completed videos
- Retry/cancel functionality

### 2. Backend Layer (Next.js API Routes)

#### Recording API (`/api/recordings`)
- **POST `/api/recordings/enqueue`**: Queue a new recording job
- **GET `/api/recordings`**: List all jobs with optional status filtering
- **GET `/api/recordings/[id]`**: Get specific job details
- **POST `/api/recordings/[id]/start`**: Start a draft recording
- **POST `/api/recordings/[id]/cancel`**: Cancel a running job
- **POST `/api/recordings/[id]/retry`**: Retry a failed job
- **GET `/api/recordings/download/[id]`**: Download completed video
- **GET `/api/recordings/download/[id]/slide/[slideIndex]`**: Download individual slide video
- **GET `/api/recordings/download/[id]/zip`**: Download all slides as ZIP

#### Asset API (`/api/s3`)
- Presigned URL generation for secure uploads
- Direct browser-to-S3 uploads
- Asset management and cleanup

#### Options API (`/api/options`)
- Save/load sketch configurations
- Template management

### 3. Data Layer

#### PostgreSQL Database (Prisma)

**Models:**

```prisma
Template {
  id: UUID
  name: String (unique)
  description: String?
  options: JSON
  createdAt: DateTime
  updatedAt: DateTime
  snapshots: TemplateSnapshot[]
}

TemplateSnapshot {
  id: UUID
  templateId: UUID
  name: String
  options: JSON (immutable)
  createdAt: DateTime
  jobs: Job[]
}

Job {
  id: String
  snapshotId: UUID?
  template: String
  status: JobStatus (queued|active|completed|failed|cancelled|draft)
  resultUrl: String?
  thumbnails: JSON (array of URLs)
  videoUrls: JSON (array of URLs)
  progress: Int
  createdAt: DateTime
  updatedAt: DateTime
  options: JSON?
}
```

#### Redis (BullMQ Queue)
- Job queue management
- Concurrency control
- Retry logic
- Job progress tracking

#### MinIO/S3 Storage
- **Uploads**: User-uploaded assets (images, videos)
- **Renders**: Final video outputs
- **Thumbnails**: Preview images for videos
- **Frames**: Temporary frame storage during rendering

### 4. Recording Pipeline

The recording pipeline is the heart of the system, transforming p5.js sketches into video files.

#### Pipeline Stages

**1. Job Enqueueing**
```typescript
POST /api/recordings/enqueue
├─ Validate template and options
├─ Process uploaded files
├─ Create job in database (status: queued)
├─ Add job to BullMQ queue
└─ Return jobId
```

**2. Worker Processing**
```typescript
RecordingWorkerService
├─ Pick job from queue
├─ Update status to "active"
├─ Execute runRecording()
└─ Handle completion/failure
```

**3. Recording Execution**
```typescript
runRecording(jobId)
├─ Load job from database
├─ Download assets from S3
├─ Create temporary directory
│
├─ Single Sketch Recording
│   ├─ Launch Playwright browser
│   ├─ Navigate to sketch URL
│   ├─ Wait for canvas load
│   ├─ Start frame capture
│   ├─ Download frames as TAR
│   ├─ Extract frames
│   ├─ Encode with FFmpeg
│   ├─ Generate thumbnail
│   └─ Upload to S3
│
└─ Multi-Slide Recording
    ├─ For each slide:
    │   ├─ Launch browser
    │   ├─ Capture frames
    │   ├─ Encode video
    │   └─ Generate thumbnail
    ├─ Upload all videos
    └─ Update job with all URLs
```

**4. Frame Capture (Browser-Side)**
```javascript
// In p5.js sketch
window.startLoopRecording()
├─ Capture each frame as PNG
├─ Store frames in memory
├─ Create TAR archive
├─ Trigger download
└─ Report progress to parent
```

**5. Video Encoding**
```bash
ffmpeg -framerate {fps} -i frames/%04d.png \
  -c:v libx264 -preset medium -crf 23 \
  -pix_fmt yuv420p -movflags +faststart \
  output.mp4
```

## Type System & Validation

### Zod Schema Architecture

The project uses Zod for runtime type validation and form generation. All sketch options are defined using Zod schemas.

#### Schema Hierarchy

```typescript
OptionsSchema (Root)
├─ id: string
├─ name: string
├─ size: SketchSizeSchema
│   ├─ width: number (50-8192)
│   └─ height: number (50-8192)
├─ animation: SketchAnimationSchema
│   ├─ framerate: number (1-240)
│   └─ duration: number (1-60)
├─ content: ContentItem[]
├─ assets: AssetsSchema
│   ├─ images: string[]
│   └─ videos: string[]
├─ slides: SlideSchema[]
│   ├─ name: string
│   ├─ content: ContentItem[]
│   ├─ assets: AssetsSchema
│   └─ sketch: any (custom per-sketch data)
└─ sketch: any (global custom data)
```

#### Content Item Discriminated Union

```typescript
ContentItemSchema = discriminatedUnion("type", [
  BackgroundItemSchema,
  MetaItemSchema,
  TextItemSchema,
  ImageItemSchema,
  ImagesStackItemSchema,
  VisualItemSchema
])
```

Each content item type has its own schema with specific fields:

**BackgroundItemSchema**
- `type: "background"`
- `background: RGBA`
- `pattern?: PatternSchema` (grid or dots)

**TextItemSchema**
- `type: "text"`
- `content: string`
- `size: number`
- `position: Vec2`
- `align: [HorizontalAlign, VerticalAlign]`
- `font: string`
- `fill/stroke: RGBA`

**ImageItemSchema**
- `type: "image"`
- `source: string`
- `position: Vec2`
- `scale: number`
- `animation?: ImageItemAnimations`

**ImagesStackItemSchema**
- `type: "images-stack"`
- `sources: string[]`
- `position: Vec2`
- `scale: number`
- `rotation: number`
- `animation?: ImagesStackAnimations`

### Form Generation from Schemas

The `GenericItemForm` component automatically generates form fields from Zod schemas:

```typescript
// 1. Extract schema for item type
const itemSchema = ContentItemSchema.options.find(
  schema => schema.shape.type.value === itemType
)

// 2. Get field names from schema
const fieldNames = Object.keys(itemSchema.shape)

// 3. Render fields using FieldRenderer
fieldNames.map(fieldName => (
  <FieldRenderer
    fieldBasePath={`slides.${index}.content.${itemIndex}`}
    fieldName={fieldName}
    config={fieldConfig[fieldName]}
  />
))
```

## Asset Management

### Upload Flow

```
User drops file
    ↓
ControlledImageInput/ControlledImagesStackInput
    ↓
useAssetsBridge hook
    ↓
Request presigned URL from /api/s3/presigned-url
    ↓
Upload directly to S3 using presigned URL
    ↓
Update form field with S3 path
    ↓
Sync to legacy assets.images array
```

### Asset Scoping

Assets can be scoped at two levels:

1. **Global Assets** (`options.assets`)
   - Shared across all slides
   - Accessible from any content item

2. **Slide Assets** (`slides[n].assets`)
   - Specific to one slide
   - Isolated from other slides

The `TemplateAssetsProvider` context manages asset scope:

```tsx
<TemplateAssetsProvider
  scope={{ slide: activeIndex }}
  assetsName={`slides.${activeIndex}.assets`}
  jobId={options.id}
>
  <ContentItems />
</TemplateAssetsProvider>
```

## Rendering Architecture

### Headless Browser Strategy

The system uses Playwright to run sketches in a headless Chromium browser:

**Benefits:**
- Exact browser environment (no SSR quirks)
- Full p5.js compatibility
- GPU acceleration support
- Consistent rendering across platforms

**Process:**
1. Launch headless browser with device scale factor
2. Navigate to sketch URL with `?capturing` flag
3. Wait for canvas to load (`canvas#defaultCanvas0.loaded`)
4. Expose progress callback to page
5. Trigger `window.startLoopRecording()`
6. Capture frames client-side
7. Download frames as TAR archive
8. Close browser

### Frame Capture (Client-Side)

The sketch captures its own frames using canvas API:

```javascript
// Simplified version
async function startLoopRecording() {
  const frames = []
  
  for (let i = 0; i < totalFrames; i++) {
    // Let p5.js draw the frame
    await nextFrame()
    
    // Capture canvas as PNG
    const blob = await canvas.toBlob('image/png')
    frames.push(blob)
    
    // Report progress
    window.reportCaptureProgress((i / totalFrames) * 100)
  }
  
  // Create TAR archive
  const tar = await createTarArchive(frames)
  
  // Trigger download
  downloadTar(tar)
}
```

### FFmpeg Encoding

Videos are encoded using FFmpeg with optimized settings:

```bash
ffmpeg \
  -framerate 60 \              # Match sketch framerate
  -i frames/%04d.png \         # Input frame sequence
  -c:v libx264 \               # H.264 codec
  -preset medium \             # Encoding speed/quality tradeoff
  -crf 23 \                    # Quality (lower = better)
  -pix_fmt yuv420p \           # Pixel format for compatibility
  -movflags +faststart \       # Enable streaming
  output.mp4
```

### Multi-Slide Rendering

For sketches with multiple slides, the system:

1. Renders each slide as a separate video
2. Generates thumbnails for each slide
3. Stores all videos in S3
4. Updates job with array of video URLs and thumbnails

```typescript
{
  resultUrl: "url-to-first-video",
  videoUrls: ["slide-0.mp4", "slide-1.mp4", "slide-2.mp4"],
  thumbnails: ["thumb-0.jpg", "thumb-1.jpg", "thumb-2.jpg"]
}
```

## State Management

### Form State (React Hook Form)

All sketch options are managed by React Hook Form:

```typescript
const methods = useForm<SketchOption>({
  defaultValues: initOptions(loadedOptions),
  resolver: zodResolver(OptionsSchema)
})
```

**Benefits:**
- Type-safe form state
- Automatic validation
- Optimized re-renders
- Easy nested field access

### Context Providers

**TemplateAssetsProvider**
- Provides asset scope (global/slide)
- Provides assets field name
- Provides job ID
- Avoids prop drilling

**ThemeProvider** (next-themes)
- Dark/light mode support
- System preference detection

## Deployment Architecture

### Docker Compose Stack

```yaml
services:
  app:          # Next.js application
  redis:        # BullMQ queue
  minio:        # S3-compatible storage
  postgres:     # Database
```

### Environment Configuration

**Required Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `S3_ENDPOINT`: MinIO/S3 endpoint
- `S3_ACCESS_KEY`: S3 credentials
- `S3_SECRET_KEY`: S3 credentials
- `S3_BUCKET`: S3 bucket name
- `S3_REGION`: S3 region

**Optional Variables:**
- `WORKER_CONCURRENCY`: Number of concurrent rendering jobs (default: 2)
- `APP_PORT`: Application port (default: 3000)

### Scaling Considerations

**Horizontal Scaling:**
- Multiple Next.js instances behind load balancer
- Shared Redis queue
- Shared PostgreSQL database
- Shared S3 storage

**Worker Scaling:**
- Increase `WORKER_CONCURRENCY` for more parallel renders
- Deploy separate worker instances
- Monitor CPU/memory usage per job

**Database Optimization:**
- Index on `snapshotId` for job lookups
- Index on `templateId` for snapshot queries
- Regular cleanup of old jobs (BullMQ auto-cleanup)

## Security Considerations

### Asset Upload Security
- Presigned URLs with expiration
- File type validation
- Size limits
- Scoped access (per job)

### API Security
- Input validation with Zod
- SQL injection prevention (Prisma)
- Rate limiting (recommended)
- CORS configuration

### Rendering Security
- Isolated browser contexts
- Temporary file cleanup
- Resource limits (timeout, memory)
- Sandboxed execution

## Performance Optimizations

### Frontend
- Code splitting (Next.js automatic)
- Image optimization (next/image)
- Lazy loading of heavy components
- Debounced form updates

### Backend
- Connection pooling (Prisma)
- Redis caching
- Presigned URLs (direct S3 access)
- Streaming downloads

### Rendering
- Parallel slide rendering
- Frame batching
- Efficient TAR creation
- FFmpeg hardware acceleration (when available)

## Monitoring & Observability

### Logging
- Structured console logs
- Job lifecycle events
- Error tracking
- Performance metrics

### Job Tracking
- Real-time progress updates
- Detailed step breakdown
- Failure reasons
- Retry history

### Metrics (Recommended)
- Job queue length
- Average render time
- Success/failure rates
- Resource utilization
