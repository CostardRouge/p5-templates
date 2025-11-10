# Testing Streaming Mode

## Overview

The streaming mode (`captureFramesWithStreaming`) is an experimental optimization that streams frames directly to FFmpeg without writing them to disk first. This provides maximum memory efficiency and speed.

## Current Status

- ✅ **Disk-based mode** (METHOD 1): Active and stable
- 🧪 **Streaming mode** (METHOD 2): Commented out, ready for testing

## How to Enable Streaming Mode

Simply change one boolean flag at the top of `src/lib/recordSketch.ts`:

```typescript
// Change this from false to true
const USE_STREAMING_MODE = true;
```

That's it! The code will automatically use streaming mode for both single and multi-slide recordings.

## Comparison

### METHOD 1: Disk-Based (Current)

```typescript
// Capture frames to disk
await captureFramesServerSide({
  page,
  framesDirectory,
  totalFrames,
  onProgress: async (percentage) => { ... }
});

// Extract thumbnail from first frame
await captureFirstFrame(framesDirectory, thumbnailPath);

// Encode video from frames
await encodeVideoFromFrames(
  framesDirectory,
  outputVideoPath,
  options.animation,
  async (percentage) => { ... }
);

// Cleanup frames
await fs.rm(framesDirectory, { recursive: true });
```

**Pros:**
- ✅ Stable and tested
- ✅ Easy to debug (frames visible on disk)
- ✅ Can extract thumbnail from first frame
- ✅ Can resume if interrupted

**Cons:**
- ❌ Disk I/O overhead
- ❌ Requires disk space for frames
- ❌ Two-step process (capture → encode)

### METHOD 2: Streaming (Experimental)

```typescript
// Capture and encode in one step
await captureFramesWithStreaming({
  page,
  totalFrames,
  outputVideoPath,
  framerate,
  onProgress: async (percentage) => { ... }
});

// Capture thumbnail separately
const canvas = await page.locator("canvas#defaultCanvas0");
await canvas.screenshot({ path: thumbnailPath, type: "jpeg" });
```

**Pros:**
- ✅ Zero disk I/O for frames
- ✅ Lower memory usage
- ✅ Faster (single-step process)
- ✅ No cleanup needed

**Cons:**
- ❌ Harder to debug (no intermediate files)
- ❌ Cannot resume if interrupted
- ❌ FFmpeg must keep up with frame rate
- ❌ Thumbnail requires alternative method

## Testing Procedure

### 1. Enable Streaming Mode

Open `src/lib/recordSketch.ts` and change:
```typescript
const USE_STREAMING_MODE = false; // Change to true
```

### 2. Test Single Recording

```bash
# Start dev server
npm run dev

# Create a test recording
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

### 3. Monitor Performance

Watch for:
- ✅ Memory usage stays low
- ✅ No disk space used for frames
- ✅ Video is generated correctly
- ✅ Thumbnail is captured
- ✅ Progress tracking works

### 4. Compare Results

| Metric | Disk-Based | Streaming | Expected |
|--------|------------|-----------|----------|
| Memory | ~50MB | ~30MB | Lower |
| Disk I/O | High | None | Zero |
| Time | ~30s | ~25s | Faster |
| Frames on disk | Yes | No | None |

### 5. Verify Video Quality

```bash
# Check video properties
ffprobe -v error -show_entries stream=width,height,r_frame_rate,duration -of default=noprint_wrappers=1 output.mp4

# Expected output:
# width=1080
# height=1350
# r_frame_rate=60/1
# duration=5.000000
```

### 6. Test Edge Cases

- [ ] Very short video (1 second)
- [ ] Long video (30 seconds)
- [ ] High framerate (120 fps)
- [ ] Low framerate (24 fps)
- [ ] Different resolutions (720p, 1080p, 4K)
- [ ] Multi-slide recording

## Troubleshooting

### Issue: FFmpeg can't keep up

**Symptoms**: Frames are dropped, video is shorter than expected

**Solution**: 
- Reduce framerate
- Increase `waitForTimeout` delay in `captureFramesWithStreaming.ts`
- Use disk-based mode for high framerates

### Issue: Thumbnail is missing

**Symptoms**: No thumbnail generated

**Solution**: 
- Check the thumbnail capture code is uncommented
- Verify canvas screenshot works
- Alternative: Extract first frame from video using FFmpeg

### Issue: Video is corrupted

**Symptoms**: Video won't play or has artifacts

**Solution**:
- Check FFmpeg logs for errors
- Verify all frames were sent to FFmpeg
- Try disk-based mode to compare

### Issue: Memory usage is high

**Symptoms**: Memory usage doesn't decrease

**Solution**:
- Check for memory leaks in frame capture loop
- Verify FFmpeg stdin buffer is draining
- Monitor with: `node --inspect`

## Performance Benchmarks

### Expected Results (300 frames, 1080p)

| Metric | Disk-Based | Streaming | Improvement |
|--------|------------|-----------|-------------|
| Total time | 30s | 25s | 17% faster |
| Memory peak | 50MB | 30MB | 40% less |
| Disk writes | 300 files | 0 files | 100% less |
| Disk space | 15MB | 0MB | 100% less |

### Test Command

```bash
# Monitor memory and time
time node scripts/test-frame-capture.mjs

# Watch memory usage
watch -n 1 'ps aux | grep node'
```

## Rollback

If streaming mode has issues, simply change the flag back:

```typescript
const USE_STREAMING_MODE = false;
```

The system will immediately revert to the stable disk-based mode. No need to restart the server.

## Recommendations

### When to Use Disk-Based Mode

- ✅ Production environments (stable)
- ✅ Need to debug frame capture
- ✅ Want to inspect individual frames
- ✅ Need resume capability

### When to Use Streaming Mode

- ✅ Long videos (>1000 frames)
- ✅ Limited disk space
- ✅ Need maximum performance
- ✅ Testing/experimentation

## Future Improvements

1. **Hybrid mode**: Stream frames but save every Nth frame for debugging
2. **Adaptive mode**: Auto-switch based on video length
3. **Parallel streaming**: Multiple FFmpeg processes for faster encoding
4. **GPU acceleration**: Use hardware encoding (h264_videotoolbox)

## Notes

- Streaming mode is **experimental** - use at your own risk
- Always test thoroughly before using in production
- Monitor memory and CPU usage during testing
- Keep disk-based mode as fallback

## Support

For issues with streaming mode:
1. Check FFmpeg logs
2. Review `captureFramesWithStreaming.ts` code
3. Test with disk-based mode to compare
4. Report issues with detailed logs

---

**Status**: 🧪 Experimental  
**Recommended for**: Testing and optimization  
**Production ready**: Not yet - needs more testing
