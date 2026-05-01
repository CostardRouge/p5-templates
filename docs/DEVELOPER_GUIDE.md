# Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Creating a New Sketch](#creating-a-new-sketch)
4. [Working with Zod Schemas](#working-with-zod-schemas)
5. [Adding Content Items](#adding-content-items)
6. [Asset Management](#asset-management)
7. [Testing](#testing)
8. [Debugging](#debugging)
9. [Best Practices](#best-practices)
10. [Common Patterns](#common-patterns)

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** (or npm/yarn)
- **FFmpeg** installed and on PATH
- **Docker** and **Docker Compose** (for full stack)
- **AWS S3** or **MinIO** for storage

### Initial Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd social-templates-renderer
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

Create `.env.local` in the project root:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/social-pipeline

# Redis
REDIS_URL=redis://localhost:6379

# S3 Storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=social-pipeline
S3_REGION=us-east-1

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
WORKER_CONCURRENCY=2
```

4. **Start infrastructure with Docker Compose**

```bash
docker-compose up -d postgres redis minio
```

5. **Run database migrations**

```bash
npx prisma migrate dev
```

6. **Start development server**

```bash
npm run watch
```

The app will be available at `http://localhost:3000`.

### Development Workflow

The `npm run watch` command runs three processes concurrently:

1. **Next.js dev server** - Hot reloads the web app
2. **Sketch metadata watcher** - Auto-generates sketch metadata
3. **GSAP templates watcher** - Auto-generates GSAP template metadata

---

## Project Structure

```
social-templates-renderer/
├── docs/                           # Documentation
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   └── DEVELOPER_GUIDE.md
│
├── prisma/                         # Database schema and migrations
│   ├── schema.prisma
│   └── migrations/
│
├── public/                         # Static assets
│   └── assets/
│       ├── fonts/                  # Custom fonts
│       ├── images/                 # Static images
│       └── libraries/              # p5.js libraries
│
├── scripts/                        # Build and utility scripts
│   └── watch-sketches.mjs          # Auto-generate sketch metadata
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API routes
│   │   │   ├── recordings/         # Recording management
│   │   │   ├── s3/                 # Asset uploads
│   │   │   ├── options/            # Template options
│   │   │   ├── progression/        # Progress tracking
│   │   │   └── thumbnails/         # Thumbnail generation
│   │   ├── recordings/             # Recording dashboard
│   │   ├── templates/              # Template gallery and editor
│   │   └── layout.tsx              # Root layout
│   │
│   ├── components/                 # React components
│   │   ├── ClientProcessingSketch/ # Main sketch editor
│   │   │   └── components/
│   │   │       ├── TemplateOptions/
│   │   │       │   ├── components/
│   │   │       │   │   ├── ContentItems/      # Content item forms
│   │   │       │   │   ├── FieldRenderer/     # Dynamic field rendering
│   │   │       │   │   └── SketchSettings/    # Size, FPS, duration
│   │   │       │   └── TemplateOptions.tsx
│   │   │       └── SketchPreview/
│   │   ├── ScalableViewport/       # Responsive canvas container
│   │   └── ui/                     # Reusable UI components
│   │
│   ├── constants/                  # App-wide constants
│   │
│   ├── lib/                        # Core business logic
│   │   ├── connections/            # Database, Redis, S3 clients
│   │   ├── progression/            # Progress tracking
│   │   ├── jobStore.ts             # Job CRUD operations
│   │   ├── recordSketch.ts         # Single sketch recording
│   │   ├── recordSketchSlides.ts   # Multi-slide recording
│   │   └── runRecording.ts         # Recording orchestration
│   │
│   ├── p5-sketches/                # p5.js sketches
│   │   └── sketches/
│   │       ├── text-post/
│   │       │   ├── sketch.js       # p5.js code
│   │       │   └── options.json    # Default options
│   │       └── ...
│   │
│   ├── services/                   # Service layer
│   │   ├── RecordingService.ts     # Recording queue management
│   │   └── RecordingWorkerService.ts # BullMQ worker
│   │
│   ├── types/                      # TypeScript types
│   │   ├── sketch.types.ts         # Zod schemas and types
│   │   └── recording.types.ts      # Recording job types
│   │
│   └── utils/                      # Utility functions
│       ├── encodeVideoFromFrames.ts
│       ├── captureFirstFrame.ts
│       └── createBrowserPage.ts
│
├── .env.local                      # Local environment variables
├── docker-compose.yml              # Docker services
├── Dockerfile                      # Production container
├── next.config.ts                  # Next.js configuration
├── package.json                    # Dependencies and scripts
├── tailwind.config.ts              # Tailwind CSS configuration
└── tsconfig.json                   # TypeScript configuration
```

---

## Creating a New Sketch

### Step 1: Create Sketch Directory

```bash
mkdir -p src/p5-sketches/sketches/my-new-sketch
cd src/p5-sketches/sketches/my-new-sketch
```

### Step 2: Create `sketch.js`

```javascript
// sketch.js
function sketch(p, options, assets) {
  let canvas;

  p.setup = function () {
    // Create canvas with options size
    canvas = p.createCanvas(options.size.width, options.size.height);
    canvas.id("defaultCanvas0");

    // Set framerate from options
    p.frameRate(options.animation.framerate);
  };

  p.draw = function () {
    // Clear background
    p.background(246, 235, 225);

    // Your sketch logic here
    p.fill(0);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(48);
    p.text("Hello World!", p.p.width / 2, p.height / 2);
  };
}
```

### Step 3: Create `options.json`

```json
{
  "size": {
    "width": 1080,
    "height": 1350
  },
  "animation": {
    "framerate": 60,
    "duration": 6
  },
  "content": [],
  "assets": {
    "images": [],
    "videos": []
  },
  "slides": []
}
```

### Step 4: Test Your Sketch

Navigate to `http://localhost:3000/my-new-sketch` to see your sketch in action.

### Step 5: Add Custom Options

To add custom options to your sketch, extend the Zod schema:

```typescript
// src/types/sketch.types.ts

// Add to OptionsSchema
export const OptionsSchema = z.object({
  // ... existing fields ...

  sketch: z
    .object({
      myCustomOption: z.string().default("default value"),
      myNumber: z.number().min(0).max(100).default(50),
    })
    .optional(),
});
```

Then use in your sketch:

```javascript
// sketch.js
p.draw = function () {
  const customValue = options.sketch?.myCustomOption || "default";
  p.text(customValue, p.p.width / 2, p.height / 2);
};
```

---

## Working with Zod Schemas

### Understanding the Schema Hierarchy

The project uses Zod for runtime type validation and automatic form generation.

```typescript
OptionsSchema (root)
├─ size: { width, height }
├─ animation: { framerate, duration }
├─ content: ContentItem[]        // Global content items
├─ assets: { images[], videos[] } // Global assets
├─ slides: Slide[]
│   ├─ name: string
│   ├─ content: ContentItem[]    // Per-slide content
│   └─ assets: { images[], videos[] }
└─ sketch: any                    // Custom per-sketch data
```

### Creating a New Content Item Type

1. **Define the Zod schema**

```typescript
// src/types/sketch.types.ts

export const MyCustomItemSchema = z.object({
  type: z.literal("my-custom"),
  title: z.string().default(""),
  color: RGBA.default([255, 0, 0]),
  size: z.number().min(10).max(200).default(50),
});

// Add to discriminated union
export const ContentItemSchema = z.discriminatedUnion("type", [
  BackgroundItemSchema,
  MetaItemSchema,
  TextItemSchema,
  ImageItemSchema,
  ImagesStackItemSchema,
  VisualItemSchema,
  MyCustomItemSchema, // Add here
]);
```

2. **Create form configuration**

```typescript
// src/components/.../ContentItems/constants/field-config.ts

export const formConfig: FormConfig = {
  // ... existing configs ...

  "my-custom": {
    title: {
      type: "text",
      label: "Title",
      placeholder: "Enter title...",
    },
    color: {
      type: "color",
      label: "Color",
    },
    size: {
      type: "number",
      label: "Size",
      min: 10,
      max: 200,
      step: 1,
    },
  },
};
```

3. **Add to item palette**

```typescript
// src/components/.../ContentItems/constants/item-palette.ts

export const itemPalette: ItemPaletteConfig[] = [
  // ... existing items ...

  {
    type: "my-custom",
    label: "My Custom Item",
    icon: Star, // Lucide icon
    description: "Add a custom item",
  },
];
```

4. **Use in sketch**

```javascript
// sketch.js
p.draw = function () {
  // Iterate through content items
  options.content.forEach((item) => {
    if (item.type === "my-custom") {
      p.fill(...item.color);
      p.circle(p.p.width / 2, p.height / 2, item.size);
      p.text(item.title, p.p.width / 2, p.height / 2 + 50);
    }
  });
};
```

### Schema Best Practices

1. **Always provide defaults**

```typescript
// Good
z.string().default("");
z.number().min(0).max(100).default(50);

// Bad - can cause validation errors
z.string();
z.number();
```

2. **Use descriptive field names**

```typescript
// Good
horizontalMargin: z.number();
textAlignment: z.enum(["left", "center", "right"]);

// Bad
margin: z.number(); // Which margin?
align: z.string(); // What values are valid?
```

3. **Add validation constraints**

```typescript
// Good
z.number().min(1).max(240); // Framerate
z.number().min(50).max(8192); // Canvas size

// Bad
z.number(); // Any number is valid?
```

4. **Use discriminated unions for variants**

```typescript
// Good
z.discriminatedUnion("type", [
  z.object({ type: z.literal("grid"), columns: z.number() }),
  z.object({ type: z.literal("dots"), radius: z.number() }),
]);

// Bad - harder to type and validate
z.object({
  type: z.enum(["grid", "dots"]),
  columns: z.number().optional(),
  radius: z.number().optional(),
});
```

---

## Adding Content Items

Content items are modular pieces that can be added to sketches. They're automatically rendered in forms and can be used in your p5.js code.

### Built-in Content Items

1. **Background** - Solid colors and patterns
2. **Meta** - Corner text and slide progression
3. **Text** - Positioned text with fonts and colors
4. **Image** - Single image with positioning and animations
5. **Images Stack** - Multiple images with effects
6. **Visual** - Custom visual effects (neon-graffiti, etc.)

### Using Content Items in Sketches

```javascript
// sketch.js
p.draw = function () {
  // Process content items in order
  options.content.forEach((item) => {
    switch (item.type) {
      case "background":
        p.background(...item.background);
        break;

      case "text":
        p.fill(...item.fill);
        p.textSize(item.size);
        p.textAlign(
          p[item.align[0].toUpperCase()],
          p[item.align[1].toUpperCase()],
        );
        const x = item.position.x * p.width;
        const y = item.position.y * p.height;
        p.text(item.content, x, y);
        break;

      case "image":
        if (assets.images[item.source]) {
          const img = assets.images[item.source];
          const x = item.position.x * p.width;
          const y = item.position.y * p.height;
          p.image(img, x, y);
        }
        break;
    }
  });
};
```

### Multi-Slide Support

For sketches with multiple slides:

```javascript
// sketch.js
let currentSlideIndex = 0;

p.setup = function () {
  // ... setup code ...

  // Calculate slide duration
  const totalFrames = options.animation.framerate * options.animation.duration;
  const framesPerSlide = Math.floor(totalFrames / options.slides.length);

  // Store for later
  p.framesPerSlide = framesPerSlide;
};

p.draw = function () {
  // Calculate current slide
  currentSlideIndex = Math.floor(p.frameCount / p.framesPerSlide);
  const slide = options.slides[currentSlideIndex];

  if (!slide) return;

  // Render slide content
  slide.content.forEach((item) => {
    // ... render item ...
  });
};
```

---

## Asset Management

### Uploading Assets

Assets are uploaded directly to S3 using presigned URLs:

```typescript
// Example: Upload an image
async function uploadImage(file: File, jobId: string) {
  // 1. Get presigned URL
  const response = await fetch("/api/s3/presigned-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      jobId,
    }),
  });

  const { uploadUrl, fileUrl } = await response.json();

  // 2. Upload to S3
  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  // 3. Return S3 URL
  return fileUrl;
}
```

### Using Assets in Sketches

Assets are preloaded and passed to your sketch:

```javascript
// sketch.js
function sketch(p, options, assets) {
  p.setup = function () {
    // Assets are already loaded
    console.log("Available images:", Object.keys(assets.images));
    console.log("Available videos:", Object.keys(assets.videos));
  };

  p.draw = function () {
    // Use loaded assets
    const img = assets.images["my-image.jpg"];
    if (img) {
      p.image(img, 0, 0);
    }
  };
}
```

### Asset Scoping

Assets can be scoped globally or per-slide:

```json
{
  "assets": {
    "images": ["global-image.jpg"]
  },
  "slides": [
    {
      "name": "Slide 1",
      "assets": {
        "images": ["slide-1-image.jpg"]
      }
    }
  ]
}
```

In your sketch:

```javascript
// Access global assets
const globalImg = assets.images["global-image.jpg"];

// Access slide-specific assets
const slide = options.slides[currentSlideIndex];
const slideImg = assets.images["slide-1-image.jpg"];
```

---

## Testing

### Manual Testing

1. **Test sketch rendering**
   - Navigate to `/[sketh-category]/[sketch-name]`
   - Verify sketch renders correctly
   - Test parameter changes
   - Test asset uploads

2. **Test recording**
   - Click "Record" button
   - Monitor progress in console
   - Verify video output
   - Check thumbnail generation

3. **Test multi-slide**
   - Add multiple slides
   - Verify slide transitions
   - Check individual slide downloads

### Automated Testing (Future)

Consider adding:

```typescript
// __tests__/sketch.test.ts
import { OptionsSchema } from "@/types/sketch.types";

describe("OptionsSchema", () => {
  it("should validate valid options", () => {
    const valid = {
      size: { width: 1080, height: 1350 },
      animation: { framerate: 60, duration: 6 },
    };

    expect(() => OptionsSchema.parse(valid)).not.toThrow();
  });

  it("should reject invalid framerate", () => {
    const invalid = {
      animation: { framerate: 300 }, // Max is 240
    };

    expect(() => OptionsSchema.parse(invalid)).toThrow();
  });
});
```

---

## Debugging

### Debug Recording Pipeline

Enable verbose logging:

```typescript
// src/lib/recordSketch.ts

// Add console logs
console.log("[Recording] Starting job:", jobId);
console.log("[Recording] Options:", JSON.stringify(options, null, 2));
console.log("[Recording] Browser launched");
console.log("[Recording] Frames captured:", frameCount);
```

### Debug Sketch Rendering

Use p5.js console:

```javascript
// sketch.js
p.draw = function () {
  // Log frame info
  if (p.frameCount % 60 === 0) {
    console.log("Frame:", p.frameCount);
    console.log("Options:", options);
  }
};
```

### Debug Form State

Use React Hook Form DevTools:

```typescript
// Add to your component
import { DevTool } from '@hookform/devtools'

function TemplateEditor() {
  const methods = useForm()

  return (
    <>
      <FormProvider {...methods}>
        {/* Your form */}
      </FormProvider>
      <DevTool control={methods.control} />
    </>
  )
}
```

### Common Issues

**Issue: Canvas not loading**

- Check browser console for errors
- Verify p5.js is loaded
- Ensure canvas has correct ID: `defaultCanvas0`

**Issue: Recording fails**

- Check FFmpeg is installed: `ffmpeg -version`
- Verify browser can access sketch URL
- Check disk space for temporary files

**Issue: Assets not loading**

- Verify S3 credentials
- Check CORS configuration
- Ensure presigned URLs haven't expired

**Issue: Form not updating**

- Check Zod schema has defaults
- Verify field names match schema
- Use React DevTools to inspect form state

---

## Best Practices

### Code Organization

1. **Keep sketches self-contained**
   - Each sketch in its own directory
   - Include `sketch.js` and `options.json`
   - Document custom options

2. **Use TypeScript everywhere**
   - Type all function parameters
   - Use Zod for runtime validation
   - Avoid `any` types

3. **Follow naming conventions**
   - Components: PascalCase
   - Functions: camelCase
   - Constants: UPPER_SNAKE_CASE
   - Files: kebab-case

### Performance

1. **Optimize sketch rendering**
   - Use `p.noLoop()` for static content
   - Cache expensive calculations
   - Minimize DOM operations

2. **Optimize asset loading**
   - Compress images before upload
   - Use appropriate image formats (JPEG for photos, PNG for graphics)
   - Consider lazy loading for large assets

3. **Optimize recording**
   - Use appropriate framerate (30-60 fps)
   - Keep duration reasonable (< 30 seconds)
   - Clean up temporary files

### Security

1. **Validate all inputs**
   - Use Zod schemas
   - Sanitize file uploads
   - Validate file types and sizes

2. **Secure S3 access**
   - Use presigned URLs
   - Set appropriate expiration times
   - Implement access controls

3. **Protect API endpoints**
   - Add rate limiting
   - Implement authentication (future)
   - Validate job ownership

---

## Common Patterns

### Pattern: Conditional Rendering

```javascript
// sketch.js
p.draw = function () {
  options.content.forEach((item) => {
    // Only render if visible
    if (item.visible !== false) {
      renderItem(item);
    }
  });
};
```

### Pattern: Animation Easing

```javascript
// sketch.js
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

p.draw = function () {
  const progress = p.frameCount / totalFrames;
  const eased = easeInOutCubic(progress);

  // Use eased value for smooth animations
  const x = p.lerp(startX, endX, eased);
};
```

### Pattern: Responsive Positioning

```javascript
// sketch.js
function getPosition(item) {
  return {
    x: item.position.x * p.width,
    y: item.position.y * p.height,
  };
}

p.draw = function () {
  options.content.forEach((item) => {
    const pos = getPosition(item);
    p.circle(pos.x, pos.y, 50);
  });
};
```

### Pattern: Asset Fallbacks

```javascript
// sketch.js
function getImage(path) {
  return assets.images[path] || assets.images["default.jpg"];
}

p.draw = function () {
  const img = getImage("my-image.jpg");
  p.image(img, 0, 0);
};
```

### Pattern: Progress Tracking

```javascript
// sketch.js
function getSlideProgress() {
  const slideFrames = p.frameCount % p.framesPerSlide;
  return slideFrames / p.framesPerSlide;
}

p.draw = function () {
  const progress = getSlideProgress();

  // Fade in at start
  if (progress < 0.1) {
    p.tint(255, progress * 10 * 255);
  }

  // Fade out at end
  if (progress > 0.9) {
    p.tint(255, (1 - progress) * 10 * 255);
  }
};
```

---

## Next Steps

1. **Explore existing sketches** in `src/p5-sketches/sketches/`
2. **Read the architecture docs** to understand the system
3. **Create your first sketch** following the guide above
4. **Join the community** and share your creations

Happy coding! 🎨
