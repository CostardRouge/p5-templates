#!/usr/bin/env node

/**
 * Test script for server-side frame capture
 * 
 * Usage:
 *   node scripts/test-frame-capture.mjs
 * 
 * This script tests the new server-side frame capture implementation
 * and compares performance metrics.
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  url: 'http://localhost:3000/templates/basic-template?capturing',
  totalFrames: 60, // 1 second at 60fps
  outputDir: path.join(__dirname, '../tmp/test-frames'),
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function captureFramesServerSide(page, framesDirectory, totalFrames) {
  await fs.mkdir(framesDirectory, { recursive: true });

  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  log(`\n📸 Capturing ${totalFrames} frames...`, colors.blue);

  // Initialize sketch
  await page.evaluate(() => {
    // @ts-ignore
    if (typeof window.noLoop === 'function') {
      // @ts-ignore
      window.noLoop();
    }
    // @ts-ignore
    if (typeof window.time?.reset === 'function') {
      // @ts-ignore
      window.time.reset();
    }
  });

  // Capture frames
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    // Trigger frame draw
    await page.evaluate(() => {
      // @ts-ignore
      if (typeof window.redraw === 'function') {
        // @ts-ignore
        window.redraw();
      }
    });

    await page.waitForTimeout(10);

    // Extract frame
    const frameDataUrl = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#defaultCanvas0');
      if (!canvas) throw new Error('Canvas not found');
      return canvas.toDataURL('image/png');
    });

    // Decode and write
    const base64Data = frameDataUrl.replace(/^data:image\/png;base64,/, '');
    const frameBuffer = Buffer.from(base64Data, 'base64');
    const framePath = path.join(
      framesDirectory,
      `frame_${String(frameIndex).padStart(5, '0')}.png`
    );
    await fs.writeFile(framePath, frameBuffer);

    // Progress
    if ((frameIndex + 1) % 10 === 0 || frameIndex === totalFrames - 1) {
      const progress = Math.round(((frameIndex + 1) / totalFrames) * 100);
      process.stdout.write(`\r   Progress: ${progress}%`);
    }
  }

  const endTime = Date.now();
  const endMemory = process.memoryUsage().heapUsed;

  console.log(''); // New line after progress

  return {
    duration: endTime - startTime,
    memoryUsed: endMemory - startMemory,
    framesDirectory,
  };
}

async function getDirectorySize(dirPath) {
  let totalSize = 0;
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);
    totalSize += stats.size;
  }
  
  return totalSize;
}

async function runTest() {
  log('\n╔════════════════════════════════════════════════════════╗', colors.bright);
  log('║     Server-Side Frame Capture Test                    ║', colors.bright);
  log('╚════════════════════════════════════════════════════════╝', colors.bright);

  let browser;
  let testPassed = true;

  try {
    // Clean up old test files
    log('\n🧹 Cleaning up old test files...', colors.yellow);
    await fs.rm(TEST_CONFIG.outputDir, { recursive: true, force: true });

    // Launch browser
    log('\n🚀 Launching browser...', colors.blue);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to sketch
    log(`\n🌐 Loading sketch: ${TEST_CONFIG.url}`, colors.blue);
    await page.goto(TEST_CONFIG.url, { waitUntil: 'networkidle' });
    
    // Wait for canvas
    log('⏳ Waiting for canvas to load...', colors.blue);
    await page.waitForSelector('canvas#defaultCanvas0.loaded', { timeout: 30000 });
    log('✅ Canvas loaded', colors.green);

    // Capture frames
    const result = await captureFramesServerSide(
      page,
      TEST_CONFIG.outputDir,
      TEST_CONFIG.totalFrames
    );

    // Get frame files
    const frameFiles = await fs.readdir(TEST_CONFIG.outputDir);
    const totalSize = await getDirectorySize(TEST_CONFIG.outputDir);

    // Display results
    log('\n╔════════════════════════════════════════════════════════╗', colors.bright);
    log('║     Test Results                                       ║', colors.bright);
    log('╚════════════════════════════════════════════════════════╝', colors.bright);

    log(`\n📊 Performance Metrics:`, colors.bright);
    log(`   • Frames captured: ${frameFiles.length}/${TEST_CONFIG.totalFrames}`);
    log(`   • Total time: ${formatTime(result.duration)}`);
    log(`   • Time per frame: ${formatTime(result.duration / TEST_CONFIG.totalFrames)}`);
    log(`   • Memory used: ${formatBytes(result.memoryUsed)}`);
    log(`   • Total disk size: ${formatBytes(totalSize)}`);
    log(`   • Avg frame size: ${formatBytes(totalSize / frameFiles.length)}`);

    // Verify frames
    log(`\n🔍 Verification:`, colors.bright);
    if (frameFiles.length === TEST_CONFIG.totalFrames) {
      log(`   ✅ All frames captured successfully`, colors.green);
    } else {
      log(`   ❌ Frame count mismatch!`, colors.red);
      testPassed = false;
    }

    // Check frame naming
    const firstFrame = frameFiles[0];
    const lastFrame = frameFiles[frameFiles.length - 1];
    log(`   • First frame: ${firstFrame}`);
    log(`   • Last frame: ${lastFrame}`);

    if (firstFrame === 'frame_00000.png' && lastFrame === `frame_${String(TEST_CONFIG.totalFrames - 1).padStart(5, '0')}.png`) {
      log(`   ✅ Frame naming correct`, colors.green);
    } else {
      log(`   ⚠️  Frame naming may be incorrect`, colors.yellow);
    }

    // Estimated performance for longer videos
    log(`\n📈 Estimated Performance for Longer Videos:`, colors.bright);
    const estimateFor = [300, 600, 1800]; // 5s, 10s, 30s at 60fps
    for (const frames of estimateFor) {
      const estimatedTime = (result.duration / TEST_CONFIG.totalFrames) * frames;
      const estimatedMemory = (result.memoryUsed / TEST_CONFIG.totalFrames) * frames;
      const estimatedSize = (totalSize / TEST_CONFIG.totalFrames) * frames;
      const duration = frames / 60;
      log(`   • ${duration}s video (${frames} frames):`);
      log(`     - Time: ~${formatTime(estimatedTime)}`);
      log(`     - Memory: ~${formatBytes(estimatedMemory)}`);
      log(`     - Disk: ~${formatBytes(estimatedSize)}`);
    }

    // Final status
    log('\n╔════════════════════════════════════════════════════════╗', colors.bright);
    if (testPassed) {
      log('║     ✅ TEST PASSED                                     ║', colors.green + colors.bright);
    } else {
      log('║     ❌ TEST FAILED                                     ║', colors.red + colors.bright);
    }
    log('╚════════════════════════════════════════════════════════╝', colors.bright);

    log(`\n📁 Test frames saved to: ${TEST_CONFIG.outputDir}`, colors.blue);
    log(`   To view frames: open ${TEST_CONFIG.outputDir}`, colors.blue);
    log(`   To clean up: rm -rf ${TEST_CONFIG.outputDir}\n`, colors.blue);

  } catch (error) {
    log('\n❌ Test failed with error:', colors.red);
    console.error(error);
    testPassed = false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  process.exit(testPassed ? 0 : 1);
}

// Run test
runTest();
