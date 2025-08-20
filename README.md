# Social pipeline

Reusable, dynamic p5.js sketches you can parameterize in the browser and render to video on demand. Built so I can keep creating and publishing motion pieces while on a working holiday in Australia—without living on social media or a laptop.
I design a sketch once, give it a typed options schema, preview and tweak on a web page, then hit “Export.” A background recorder renders the final video and makes it easy to download straight to my phone. The long‑term vision includes automations that trigger renders from real‑life events (calendar, GitHub, weather, personal notes, etc.).


## Demo (concept)

Edit options live (size, framerate, duration, colors, per‑item parameters)
Drop images and re-use them across items (single image or image stacks)
Export → render runs in the background → download when ready

## Why

Timeboxed life on the road: keep making without high overhead.
Reusability: sketches become templates with typed, documented options.
Automation: unlock “render on events” workflows later.

## Tech stack

- Frontend: React + Next.js + TypeScript
- Forms: react-hook-form + Zod (schema = validation + defaults + docs)
- Styling/UI: Tailwind CSS + lucide-react icons
- Sketch runtime: p5.js (in browser; headless capture for renders)
- Assets: S3 (images/videos/sounds), drag‑and‑drop uploads with legacy compatibility
- Rendering: Headless browser + FFmpeg pipeline (API/worker)
- State glue: Context to provide “assets scope” (global/slide) and jobId to form fields
- Queuing (planned/optional): BullMQ/Redis or equivalent

## Architecture overview

- Web app (Next.js)
  - Template editor: preview a p5.js sketch, typed controls from Zod schemas
  - Dynamic content items: text, image, images-stack, background, meta…
  - Legacy assets bridge: keeps a legacy assets.images array in sync while RHF controls single/multi image fields
  - Export button: POST to the render API; shows progress and download link


- Render API + Worker
  - Spins up a headless runtime for the sketch with the given parameters (size, fps, duration…)
  - Captures frames, muxes to a video via FFmpeg, stores artifact, returns URL
  - Designed to move to a queue for scale

## Key form patterns (already implemented)

- ControlledImageInput and ControlledImagesStackInput (array) with:
  - Drag‑and‑drop upload → S3
  - Thumbnail preview
  - Reorder (for stacks)
  - Sync to legacy assets.images so older sketches still work

- TemplateAssetsProvider context:
Provides scope (global or a specific slide), assetsName, and jobId to controlled fields
Avoids prop drilling through FieldRenderer


- Zod-first schemas:
  - One source of truth for defaults, validation, and migration (legacy index → path)


## Getting started
### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn
- FFmpeg installed and on PATH (for render muxing)
- AWS S3 bucket and credentials (or compatible S3 provider)
- Optional: Redis (if you enable background queueing)

1) Clone and install
   git clone <your-repo-url>
   cd social-templates-renderer
   pnpm install
2) Environment variables
   Create a .env.local at the project root. Adjust to your setup.


### App
`NEXT_PUBLIC_BASE_URL=http://localhost:3000`

# Rendering
RENDERER_BASE_URL=http://localhost:3000 # or separate API host
RENDER_OUTPUT_BUCKET=your-render-bucket
RENDER_OUTPUT_PREFIX=renders/

# S3 (for uploads and outputs)
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=your-assets-bucket
AWS_ACCESS_KEY_ID=xxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxx

# Optional queueing
REDIS_URL=redis://localhost:6379
If you split API/worker from the Next.js app, mirror these in each service as needed.
3) Run in development
   Single app (Next.js with API routes):
   pnpm dev
   Split services (example):
# web
pnpm --filter @app/web dev

# api
pnpm --filter @app/api dev

# worker (render jobs)
pnpm --filter @app/worker dev
Check package.json scripts and use the ones defined in this repo.
Project conventions

Type‑safe everywhere (TS + Zod)
One schema, many uses:
Form defaults
Validation
Migration of legacy fields

No prop drilling for cross‑cutting context (assets scope, jobId)
Keep “legacy assets library” hydrated for old sketches while new fields are RHF‑controlled

Folder structure (example)
.
├─ apps/
│  ├─ web/                     # Next.js app
│  │  ├─ components/
│  │  │  ├─ TemplateOptions/
│  │  │  │  ├─ ContentLayerListForm/
│  │  │  │  │  ├─ FieldRenderer.tsx
│  │  │  │  │  ├─ ControlledImageInput/
│  │  │  │  │  ├─ ControlledImagesStackInput/
│  │  │  │  ├─ ConditionalGroup/
│  │  │  ├─ AddItemControls.tsx
│  │  ├─ ui/items/
│  │  │  ├─ ItemPalette.tsx
│  │  │  └─ item-kinds.ts
│  │  ├─ context/TemplateAssetsContext.tsx
│  │  ├─ hooks/useAssetsBridge.ts
│  │  ├─ pages/ or app/
│  ├─ api/                     # Optional: dedicated API
│  └─ worker/                  # Optional: render worker
├─ packages/
│  ├─ schemas/
│  │  ├─ items.ts              # Zod item schemas
│  │  ├─ options.ts            # Zod options/slides/assets
│  │  ├─ migrate.ts            # legacy migration (index → path)
│  │  └─ init.ts               # hydrate defaults: initOptions()
└─ ...

Adapt to your actual layout.
Setup details
Initialize options.json safely
Use Zod defaults + a legacy migration to ensure partially‑filled options load without errors.
import { initOptions } from "@/schema/init";

const defaults = initOptions(initialOptionsJson);
// pass defaults to react-hook-form defaultValues

OptionsSchema.parse() fills any missing fields per .default(...).

Adding items with icons
Use the included palette and default item factory:
import { AddItemControls } from "@/components/AddItemControls";

<AddItemControls baseFieldName="slides.0.content" compact />

Icons provided by lucide-react
Valid, defaulted items created via Zod (makeDefaultItem(kind))

Image inputs and stacks

Use ControlledImageInput for a single image path (src)
Use ControlledImagesStackInput for multiple paths (items)
Both use useAssetsBridge() to upload via legacy pipeline and sync assets.images
Wrap your editor in TemplateAssetsProvider:

<TemplateAssetsProvider
scope={{ slide: activeIndex }}
assetsName={`slides.${activeIndex}.assets`}
jobId={options.id}
>
<ContentLayerListForm baseFieldName={`slides.${activeIndex}.content`} />
</TemplateAssetsProvider>


Roadmap
Short term (v0.3 – v0.5)

Stabilize form generator
Full coverage for text, image, images‑stack, background, meta
Drag‑reorder for stacks, keyboard access


Asset pipeline
Progress UI for uploads
Dedupe + reference counting across items
Safe delete (no in‑use removal)


Rendering
FFmpeg+headless capture solidified
Export status + retry
Download on mobile with iOS/Android friendly headers


DX
Example sketches and templates
Schema‑driven docs panel (autogenerated from Zod)



Mid term (v0.6 – v0.9)

Job system
Move to queue (BullMQ/Redis) with concurrency + backoff
Webhooks for job completion
Signed URLs for outputs


Templates
“Save as template” and gallery
Batch renders (playlists) with parameter sets


Assets
S3 multipart uploads and resume
Image transforms/thumbnails via CDN or Lambda@Edge


Editor UX
Per‑item visibility toggles and quick duplication
Undo/redo, versioned options.json snapshots



v1.0

Automations
Triggers: calendar, GitHub events, weather, personal notes
Rules engine + scheduler
Audit log of renders


Distribution
One‑tap publish to socials/cloud drives (optional)
RSS/JSON feed of rendered outputs


Multi‑tenant & auth (optional)
User accounts, tokens for API
Team spaces and shared assets


Performance
Headless render pool, GPU‑backed runners where available
Cost guardrails (budgets/quotas)



Nice‑to‑haves

PWA for offline editing on mobile (download later when online)
CLI for local/batch rendering
Plugin API for custom form widgets and render backends
AI assist to propose parameter sets or colorways

Contributing
Thanks for your interest—PRs and issues welcome!

Fork and clone

git clone <your-fork-url>
pnpm install

Run checks locally

pnpm typecheck
pnpm lint
pnpm test       # if tests are present
pnpm dev

Branch and commit


Create a feature branch: feat/<short-name> or fix/<short-name>
Use Conventional Commits:
feat: add images stack reorder
fix: handle empty options defaults
chore: bump deps




Coding style


TypeScript strict mode where possible
Prefer Zod for any runtime validation
Keep components small; use contexts for cross‑cutting concerns (no prop drilling)
Co-locate tests next to code when applicable


Open a PR


Describe the change, screenshots for UI tweaks
Note any migration required (schema changes)
Link issue if applicable


Code review


Be open to feedback; we optimize for clarity, accessibility, and resilience

FAQ

Why keep a legacy assets.images?

Older sketches reference images by path from a central array. The bridge keeps this list updated while modern fields (single/multi) stay RHF-controlled.


Do I need Redis?

Not for local dev. For scale and reliability, a queue is recommended so renders don’t block requests.


Can I use another storage than S3?

Any S3‑compatible provider should work; adjust the SDK endpoint/credentials.



License
MIT. See LICENSE file.
Acknowledgements

- p5.js for a joyful creative coding API
- FFmpeg for the heavy lifting
- react-hook-form + Zod for ergonomic, robust forms
