#!/usr/bin/env node
import { spawn } from "child_process";

const processes = [];

// Function to restore terminal state
function restoreTerminal() {
  // Clear any pending input
  process.stdin.setRawMode?.(false);

  // Reset terminal to cooked mode
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.stdout.write('\x1b[0m');   // Reset text attributes
    process.stdout.write('\n');        // New line
  }
}

// Function to kill all processes
function killAllProcesses() {
  console.log('\n👋 Shutting down all processes...');

  processes.forEach(proc => {
    try {
      proc.kill('SIGTERM');
    } catch (err) {
      console.warn(`Failed to kill process ${proc.pid}:`, err.message);
    }
  });

  // Give processes time to shut down gracefully
  setTimeout(() => {
    processes.forEach(proc => {
      try {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch (err) {
        // Ignore errors
      }
    });
    process.exit(0);
  }, 2000);
}

// Handle various termination signals
function setupSignalHandlers() {
  const signals = ['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'];

  signals.forEach(signal => {
    process.on(signal, () => {
      console.log(`\n📡 Received ${signal}, initiating graceful shutdown...`);
      restoreTerminal();
      killAllProcesses();
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    restoreTerminal();
    killAllProcesses();
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    restoreTerminal();
    killAllProcesses();
  });
}

// Function to start a process
function startProcess(name, command, args = []) {
  console.log(`🚀 Starting ${name}...`);

  const proc = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  processes.push(proc);

  // Pipe output with prefixes
  proc.stdout.on('data', (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  proc.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      console.warn(`⚠️  ${name} exited unexpectedly with code ${code}`);
    }
  });

  proc.on('error', (err) => {
    console.error(`[${name}] Error:`, err.message);
  });

  return proc;
}

async function main() {
  console.log('🎬 Starting Social Templates Renderer in development mode...\n');

  // Setup signal handlers for graceful shutdown
  setupSignalHandlers();

  try {
    // Start the watch processes
    const sketchWatcher = startProcess('sketch-meta', 'npm', ['run', 'sketch:meta']);
    const gsapWatcher = startProcess('gsap-meta', 'npm', ['run', 'gsap:meta']);
    const nextDev = startProcess('next-dev', 'npm', ['run', 'dev']);

    // Wait for all processes
    await Promise.allSettled([
      new Promise((resolve) => sketchWatcher.on('close', resolve)),
      new Promise((resolve) => gsapWatcher.on('close', resolve)),
      new Promise((resolve) => nextDev.on('close', resolve))
    ]);

  } catch (error) {
    console.error('❌ Failed to start processes:', error);
    restoreTerminal();
    killAllProcesses();
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  restoreTerminal();
  process.exit(1);
});