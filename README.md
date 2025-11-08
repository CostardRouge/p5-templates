# Social Templates Renderer

> Transform your p5.js sketches into parameterized video templates with a web-based editor and automated rendering pipeline.

Reusable, dynamic p5.js sketches you can parameterize in the browser and render to video on demand. Built to enable continuous creative output while traveling—design a sketch once, give it a typed options schema, preview and tweak parameters in real-time, then hit "Record." A background worker renders the final video and makes it available for download on any device.

**Live Demo:** https://social-pipeline-pi.vercel.app/templates  
**Docker Hub:** https://hub.docker.com/repository/docker/containeurrouge/social-templates-renderer/general

## 📚 Documentation

- **[Architecture Guide](./docs/ARCHITECTURE.md)** - System design, data flow, and technical architecture
- **[API Reference](./docs/API_REFERENCE.md)** - Complete API endpoint documentation
- **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** - Setup, project structure, and development workflow
- **[Sketch Creation Guide](./docs/SKETCH_CREATION_GUIDE.md)** - How to create and customize p5.js sketches
- **[Deployment Guide](./DEPLOYMENT.md)** - Docker deployment and database migrations

## ✨ Features

- **🎨 Dynamic Form Generation** - Forms automatically generated from Zod schemas
- **👁️ Live Preview** - Real-time sketch rendering with instant parameter updates
- **📦 Asset Management** - Drag-and-drop image/video uploads with S3 storage
- **🎬 Multi-Slide Support** - Create videos with multiple scenes/slides
- **⚙️ Background Rendering** - Queue-based video rendering with Playwright + FFmpeg
- **📊 Progress Tracking** - Real-time rendering progress with detailed steps
- **🔄 Modular Content System** - Reusable components (background, text, images, visuals)
- **💾 Template Snapshots** - Version control for sketch configurations
- **🐳 Docker Ready** - Full stack deployment with Docker Compose
- **🔒 Type-Safe** - End-to-end TypeScript with Zod validation

## 🎯 Use Cases

- **Content Creation on the Go** - Design once, render anywhere, download on mobile
- **Reusable Templates** - Turn sketches into parameterized templates
- **Batch Rendering** - Queue multiple videos with different parameters
- **Automated Workflows** - Future: trigger renders from external events (calendar, GitHub, weather)

## 🛠️ Tech Stack

**Frontend**
- React 19 + Next.js 15 (App Router)
- TypeScript (strict mode)
- Tailwind CSS + Lucide React icons
- React Hook Form + Zod (type-safe forms)

**Backend**
- Next.js API Routes
- Prisma ORM + PostgreSQL
- BullMQ + Redis (job queue)
- MinIO/S3 (asset storage)

**Rendering Pipeline**
- p5.js (creative coding framework)
- Playwright (headless browser)
- FFmpeg (video encoding)

**Infrastructure**
- Docker + Docker Compose
- Nginx (optional reverse proxy)
- Vercel (demo deployment)

## 🏗️ Architecture Overview

```
Browser → Next.js App → API Routes → BullMQ Queue → Worker
                ↓                                      ↓
           PostgreSQL ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                ↓
              MinIO/S3 (Assets & Videos)
```

**Key Components:**

1. **Web App** - Template gallery, sketch editor with live preview, recording dashboard
2. **API Layer** - Recording management, asset uploads, progress tracking
3. **Job Queue** - BullMQ with Redis for async video rendering
4. **Worker** - Playwright (headless browser) + FFmpeg (video encoding)
5. **Database** - PostgreSQL with Prisma for jobs, templates, and snapshots
6. **Storage** - S3-compatible storage for assets and rendered videos

For detailed architecture documentation, see [Architecture Guide](./docs/ARCHITECTURE.md).

## 🎨 How It Works

1. **Create a Sketch** - Write p5.js code with parameterized options
2. **Define Schema** - Use Zod to define typed options (colors, sizes, text, etc.)
3. **Edit in Browser** - Auto-generated form with live preview
4. **Upload Assets** - Drag-and-drop images/videos directly to S3
5. **Hit Record** - Job queued and processed in background
6. **Download Video** - Get MP4 output on any device

See [Sketch Creation Guide](./docs/SKETCH_CREATION_GUIDE.md) for detailed tutorials.


## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** (or npm/yarn)
- **FFmpeg** installed and on PATH
- **Docker** and **Docker Compose** (for full stack)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/social-templates-renderer.git
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

4. **Start infrastructure services**

```bash
docker-compose up -d postgres redis minio
```

5. **Run database migrations**

```bash
npx prisma migrate dev
```

6. **Start development server**

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

For detailed setup instructions, see the [Developer Guide](./docs/DEVELOPER_GUIDE.md).

## 🗺️ Roadmap

### Current (v0.2)
- ✅ Dynamic form generation from Zod schemas
- ✅ Multi-slide support with transitions
- ✅ Background rendering with BullMQ
- ✅ S3 asset management
- ✅ Real-time progress tracking
- ✅ Docker deployment

### Short Term (v0.3 - v0.5)
- [ ] Enhanced asset pipeline with progress UI
- [ ] Drag-reorder for content items
- [ ] Mobile-optimized download experience
- [ ] Template gallery with search/filter
- [ ] Batch rendering with parameter sets

### Mid Term (v0.6 - v0.9)
- [ ] Webhook notifications for job completion
- [ ] Template versioning and rollback
- [ ] Video preview before full render
- [ ] Custom visual effects library
- [ ] CLI for local/batch rendering

### Long Term (v1.0+)
- [ ] Event-driven automation (calendar, GitHub, weather)
- [ ] Multi-tenant support with authentication
- [ ] Plugin system for custom components
- [ ] AI-assisted parameter suggestions
- [ ] GPU-accelerated rendering

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork and clone**
   ```bash
   git clone <your-fork-url>
   pnpm install
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature
   # or
   git checkout -b fix/your-bugfix
   ```

3. **Follow coding standards**
   - TypeScript strict mode
   - Use Zod for validation
   - Keep components small and focused
   - Add tests when applicable

4. **Use Conventional Commits**
   ```
   feat: add images stack reorder
   fix: handle empty options defaults
   chore: bump dependencies
   docs: update API reference
   ```

5. **Run checks before committing**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test  # if tests exist
   ```

6. **Open a Pull Request**
   - Describe your changes clearly
   - Include screenshots for UI changes
   - Link related issues
   - Note any breaking changes or migrations

## ❓ FAQ

**Why keep a legacy assets.images array?**  
Older sketches reference images by path from a central array. The bridge keeps this list updated while modern fields (single/multi) stay React Hook Form-controlled, ensuring backward compatibility.

**Do I need Redis for local development?**  
No. Redis is optional for local dev. For production and scale, a queue is recommended so renders don't block requests and can be processed concurrently.

**Can I use storage other than S3?**  
Yes. Any S3-compatible provider (MinIO, DigitalOcean Spaces, Backblaze B2) should work. Just adjust the SDK endpoint and credentials in your environment variables.

**How do I add custom sketch options?**  
Extend the Zod schema in `src/types/sketch.types.ts` and add fields to the `sketch` object. See the [Sketch Creation Guide](./docs/SKETCH_CREATION_GUIDE.md) for details.

**Can I deploy this to production?**  
Yes! Use the provided Dockerfile and docker-compose.yml. See [Deployment Guide](./DEPLOYMENT.md) for instructions.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgements

- **[p5.js](https://p5js.org/)** - Joyful creative coding framework
- **[FFmpeg](https://ffmpeg.org/)** - Powerful video encoding
- **[React Hook Form](https://react-hook-form.com/)** + **[Zod](https://zod.dev/)** - Type-safe form validation
- **[Playwright](https://playwright.dev/)** - Reliable browser automation
- **[BullMQ](https://docs.bullmq.io/)** - Robust job queue system

---

**Built with ❤️ by [@CostardRouge](https://github.com/CostardRouge)**

Made for creators who want to keep making while on the move. 🌏✨
