/**
 * Sliding-window frame-rate meter.
 *
 * Derives the real draw rate from a monotonically increasing frame counter
 * (p5's `frameCount`) instead of sampling an engine-reported instantaneous
 * fps: counter deltas only count frames that actually rendered, so the
 * reading is immune to rAF sampling aliasing and converges within one
 * window after a framerate change.
 */

type FrameSample = {
  time: number;
  frameCount: number;
};

const DEFAULT_WINDOW_MS = 1000;

export class FrameRateMeter {
  private samples: FrameSample[] = [];

  constructor( private readonly windowMs: number = DEFAULT_WINDOW_MS ) {}

  /**
   * Record the frame counter at `time` (ms) and return the rate over the
   * current window.
   */
  sample(
    time: number,
    frameCount: number
  ): number {
    const last = this.samples[ this.samples.length - 1 ];

    // A backwards counter or clock means the engine was rewound (seek,
    // stop, restart) — the old window no longer measures continuous
    // playback.
    if ( last && ( frameCount < last.frameCount || time < last.time ) ) {
      this.samples.length = 0;
    }

    this.samples.push( {
      time,
      frameCount
    } );

    while (
      this.samples.length > 1 &&
      time - this.samples[ 0 ].time > this.windowMs
    ) {
      this.samples.shift();
    }

    return this.fps;
  }

  get fps(): number {
    if ( this.samples.length < 2 ) {
      return 0;
    }

    const first = this.samples[ 0 ];
    const last = this.samples[ this.samples.length - 1 ];
    const elapsed = last.time - first.time;

    if ( elapsed <= 0 ) {
      return 0;
    }

    return ( ( last.frameCount - first.frameCount ) * 1000 ) / elapsed;
  }

  reset(): void {
    this.samples.length = 0;
  }
}
