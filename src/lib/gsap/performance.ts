/**
 * Performance optimization utilities for GSAP templates
 */

import gsap from 'gsap';

/**
 * Preload images before starting animation
 */
export async function preloadImages(imageUrls: string[]): Promise<void> {
  const promises = imageUrls.map((url) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  });

  await Promise.all(promises);
}

/**
 * Preload fonts before starting animation
 */
export async function preloadFonts(fontFamilies: string[]): Promise<void> {
  if (!document.fonts) return;

  const promises = fontFamilies.map(async (family) => {
    try {
      await document.fonts.load(`16px ${family}`);
    } catch (error) {
      console.warn(`Failed to load font: ${family}`, error);
    }
  });

  await Promise.all(promises);
}

/**
 * Optimize element for animation
 * Adds will-change and other performance hints
 */
export function optimizeForAnimation(element: HTMLElement | string): void {
  const el = typeof element === 'string' 
    ? document.querySelector(element) as HTMLElement
    : element;

  if (!el) return;

  // Add will-change for GPU acceleration
  el.style.willChange = 'transform, opacity';
  
  // Force GPU layer
  el.style.transform = 'translateZ(0)';
}

/**
 * Clean up animation optimizations
 */
export function cleanupAnimationOptimizations(element: HTMLElement | string): void {
  const el = typeof element === 'string'
    ? document.querySelector(element) as HTMLElement
    : element;

  if (!el) return;

  el.style.willChange = 'auto';
  el.style.transform = '';
}

/**
 * Batch DOM reads and writes for better performance
 */
export function batchDOMOperations(
  reads: Array<() => void>,
  writes: Array<() => void>
): void {
  // Perform all reads first
  reads.forEach((read) => read());
  
  // Then perform all writes
  requestAnimationFrame(() => {
    writes.forEach((write) => write());
  });
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if device has sufficient performance for complex animations
 */
export function checkPerformanceCapability(): {
  isHighPerformance: boolean;
  devicePixelRatio: number;
  hardwareConcurrency: number;
} {
  return {
    isHighPerformance: 
      navigator.hardwareConcurrency >= 4 &&
      window.devicePixelRatio <= 2,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
}

/**
 * Create a timeline with performance optimizations
 */
export function createOptimizedTimeline(config?: gsap.TimelineVars): gsap.core.Timeline {
  return gsap.timeline({
    ...config,
    // Optimize for performance
    autoRemoveChildren: true,
    smoothChildTiming: true,
  });
}

/**
 * Lazy load GSAP plugins
 */
export async function loadGSAPPlugin(pluginName: string): Promise<any> {
  switch (pluginName) {
    case 'ScrollTrigger':
      return import('gsap/ScrollTrigger').then((m) => m.ScrollTrigger);
    case 'MotionPathPlugin':
      return import('gsap/MotionPathPlugin').then((m) => m.MotionPathPlugin);
    case 'DrawSVGPlugin':
      return import('gsap/DrawSVGPlugin').then((m) => m.DrawSVGPlugin);
    default:
      throw new Error(`Unknown GSAP plugin: ${pluginName}`);
  }
}

/**
 * Monitor animation performance
 */
export class AnimationPerformanceMonitor {
  private frameCount = 0;
  private startTime = 0;
  private lastTime = 0;
  private fps = 0;

  start(): void {
    this.frameCount = 0;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.measure();
  }

  private measure(): void {
    const now = performance.now();
    this.frameCount++;

    if (now >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;
    }

    requestAnimationFrame(() => this.measure());
  }

  getFPS(): number {
    return this.fps;
  }

  getAverageFPS(): number {
    const elapsed = performance.now() - this.startTime;
    return Math.round((this.frameCount * 1000) / elapsed);
  }
}
