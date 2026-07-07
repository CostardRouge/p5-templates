# Scripts Directory

This directory contains utility scripts for the project.

## Available Scripts

### `test-frame-capture.mjs`

Tests the server-side frame capture implementation and provides performance metrics.

**Usage:**
```bash
# Make sure the dev server is running first
npm run dev

# In another terminal, run the test
node scripts/test-frame-capture.mjs
```

**What it does:**
- Launches a headless browser with Playwright
- Loads a test sketch
- Captures frames using the server-side method
- Reports performance metrics (time, memory, disk usage)
- Estimates performance for longer videos
- Verifies frame count and naming

**Output:**
```
╔════════════════════════════════════════════════════════╗
║     Server-Side Frame Capture Test                    ║
╚════════════════════════════════════════════════════════╝

📸 Capturing 60 frames...
   Progress: 100%

╔════════════════════════════════════════════════════════╗
║     Test Results                                       ║
╚════════════════════════════════════════════════════════╝

📊 Performance Metrics:
   • Frames captured: 60/60
   • Total time: 2.45s
   • Time per frame: 40.83ms
   • Memory used: 12.5 MB
   • Total disk size: 3.2 MB
   • Avg frame size: 54.61 KB

🔍 Verification:
   ✅ All frames captured successfully
   • First frame: frame_00000.png
   • Last frame: frame_00059.png
   ✅ Frame naming correct

📈 Estimated Performance for Longer Videos:
   • 5s video (300 frames):
     - Time: ~12.25s
     - Memory: ~62.5 MB
     - Disk: ~16 MB
   • 10s video (600 frames):
     - Time: ~24.5s
     - Memory: ~125 MB
     - Disk: ~32 MB
   • 30s video (1800 frames):
     - Time: ~73.5s
     - Memory: ~375 MB
     - Disk: ~96 MB

╔════════════════════════════════════════════════════════╗
║     ✅ TEST PASSED                                     ║
╚════════════════════════════════════════════════════════╝
```

### `create-placeholder-icons.mjs`

Creates placeholder icons for PWA.

### `generate-vapid-keys.mjs`

Auto-generates VAPID keys for web push notifications if not already configured.

**Usage:**
```bash
# Generate keys and update .env file
npm run setup:notifications

# Or run directly
node scripts/generate-vapid-keys.mjs

# Or use the bash wrapper
./scripts/setup-notifications.sh
```

**What it does:**
- Checks if VAPID keys already exist in .env
- Generates new public/private key pair if needed
- Updates .env file with the new keys
- Provides keys for docker-compose.yml configuration

**For NAS/Docker deployment:**
The keys are auto-generated on first container startup if not provided. To persist keys across restarts, add them to your docker-compose.yml:

```yaml
environment:
  - NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
  - VAPID_PRIVATE_KEY=your_private_key_here
```

Or mount a persistent .env file as a volume.

### `inject-sw-version.mjs`

Injects version information into the service worker.

### `dev-watch.mjs`

Improved development watch script that replaces `concurrently` for better terminal state management.

**Features:**
- Proper signal handling for graceful shutdown
- Terminal state restoration on exit (fixes "^[OA" issue)
- Prefixed output for each process
- Better error handling and cleanup

**Usage:**
```bash
# Use instead of the old concurrently-based watch command
npm run watch

# The old command is still available as:
npm run watch:legacy
```

**Why it fixes the terminal issue:**
The previous `concurrently` setup didn't properly restore terminal state when interrupted with Ctrl+C, leaving the terminal in raw mode. This script handles all signals properly and restores cooked mode before exit.

### `watch-sketches.mjs`

Watches sketch files for changes and regenerates, in one pass:

- `src/sketches/metadata.json` — the sketch catalogue used for routing/listing.
- `src/generated/sketchModuleRegistry.ts` — client+server map of `"<engine>:<sketchPath>" → () => import(".../index.js")` thunks.
- `src/generated/sketchOptionsRegistry.ts` — `server-only` map of `options.ts` / `options.json` loaders.

The registries exist so engines load a sketch through a **literal** dynamic
import (one code-split point per sketch) instead of a variable-path
`import("@/p5/sketches/${path}/index.js")`. A variable path forces the bundler
to build a context module over *every* sketch, which made the dev server
compile the whole catalogue (and balloon RAM) on each page. With the registry,
Turbopack compiles only the sketch you actually open.

All three outputs are committed (like `metadata.json`) and regenerated whenever
a sketch directory, an `index.*`, an `options.*`, or a visibility marker is
added/removed. Run a one-shot generation (no watcher, no `chokidar` needed)
with `NODE_ENV=production node scripts/watch-sketches.mjs`.

### `watch-gsap-templates.mjs`

Watches GSAP template files for changes and regenerates the template registry.

## Testing the Migration

To verify the server-side frame capture migration:

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Run the frame capture test:**
   ```bash
   node scripts/test-frame-capture.mjs
   ```

3. **Check the results:**
   - Verify all frames were captured
   - Check memory usage is low (~50MB for 300 frames)
   - Verify frame naming is correct
   - Inspect frames in `tmp/test-frames/`

4. **Test with a real recording:**
   ```bash
   # Create a test recording via API
   curl -X POST http://localhost:3000/api/recordings \
     -H "Content-Type: application/json" \
     -d '{
       "template": "basic-template",
       "options": {
         "animation": {
           "framerate": 60,
           "duration": 5
         }
       }
     }'
   ```

## Troubleshooting

### Test fails with "Canvas not found"

**Solution:** Make sure the dev server is running and the sketch loads correctly:
```bash
# Check if server is running
curl http://localhost:3000

# Check if sketch loads
open http://localhost:3000/sketches/basic-template?capturing
```

### Test fails with "ECONNREFUSED"

**Solution:** Start the dev server first:
```bash
npm run dev
```

### Frames are all identical

**Solution:** Verify the sketch uses time-based animation:
```javascript
// In p5.js sketch
function draw() {
  const t = time.elapsed; // Use time, not frameCount
  // ... animation based on t
}
```

### Out of disk space

**Solution:** Clean up test frames:
```bash
rm -rf tmp/test-frames
```

## Performance Benchmarks

Expected performance on modern hardware:

| Metric | Value |
|--------|-------|
| Time per frame | 30-50ms |
| Memory per frame | ~200KB |
| Disk per frame | ~50KB (PNG) |
| Max frames tested | 10,000+ |

### Comparison: Old vs New

| Metric | Old (Tar) | New (Server-Side) | Improvement |
|--------|-----------|-------------------|-------------|
| Memory (300 frames) | ~500MB | ~50MB | 90% less |
| Time (300 frames) | ~45s | ~30s | 33% faster |
| Max frames | ~1000 | Unlimited | No limit |

## Contributing

When adding new scripts:

1. Use `.mjs` extension for ES modules
2. Add shebang: `#!/usr/bin/env node`
3. Make executable: `chmod +x scripts/your-script.mjs`
4. Document in this README
5. Add error handling and helpful output
