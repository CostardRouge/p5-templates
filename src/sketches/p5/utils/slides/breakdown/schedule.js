// The breakdown's timeline model: maps the loop clock [0,1) onto
// intro | build | outro phases and gives every step its own strictly
// SEQUENTIAL window inside the build span — one parameter group settles at a
// time, which is the whole point of the diff narration. Pure: both the
// parameter interpolator and the overlay read this one model, so they can
// never drift apart.

function clamp01( value ) {
  if ( !Number.isFinite( value ) ) {
    return 0;
  }

  return value < 0 ? 0 : value > 1 ? 1 : value;
}

// Recording's clock climbs monotonically past 1 (see time.phase) — fold it
// back so one recorded pass equals one breakdown cycle, negatives included.
export function wrapProgression( progression ) {
  const p = Number( progression ) || 0;

  return ( ( p % 1 ) + 1 ) % 1;
}

/**
 * Build the per-step windows, in LOOP coordinates. Windows tile the build
 * span exactly: step i spans [introEnd + i·width, introEnd + (i+1)·width]
 * with width = buildSpan / stepCount.
 *
 * `holdRatio` front-loads each window: the morph happens in the first
 * (1−holdRatio) of the window (up to `lockAt`), then the value holds locked
 * while the narration finishes its lines.
 */
export function buildBreakdownSchedule(
  stepCount, build = {}
) {
  const introRatio = clamp01( build.introRatio ?? 0 );
  const outroRatio = clamp01( build.outroRatio ?? 0.1 );

  // Keep a usable build span even when intro + outro over-reserve the loop.
  const MIN_BUILD_SPAN = 0.2;

  let introEnd = introRatio;
  let outroStart = 1 - outroRatio;

  if ( outroStart - introEnd < MIN_BUILD_SPAN ) {
    const overflow = MIN_BUILD_SPAN - ( outroStart - introEnd );
    const total = introRatio + outroRatio;
    const introShare = total > 0 ? introRatio / total : 0.5;

    introEnd -= overflow * introShare;
    outroStart += overflow * ( 1 - introShare );

    introEnd = clamp01( introEnd );
    outroStart = clamp01( outroStart );
  }

  const buildSpan = outroStart - introEnd;
  const windows = [];

  if ( stepCount > 0 ) {
    const width = buildSpan / stepCount;
    const holdRatio = clamp01( build.holdRatio ?? 0.15 );

    for ( let i = 0; i < stepCount; i++ ) {
      const start = introEnd + i * width;
      const end = introEnd + ( i + 1 ) * width;

      // The morph finishes holdRatio early; from lockAt on, the value holds.
      const lockAt = start + ( end - start ) * ( 1 - holdRatio );

      windows.push( {
        start,
        end,
        lockAt
      } );
    }
  }

  return {
    introEnd,
    outroStart,
    windows
  };
}

/**
 * Resolve the timeline at a given loop progression.
 *
 * Returns:
 *   phase          "intro" | "build" | "outro"
 *   phaseT         0..1 within the current phase (outro drives the fade-out)
 *   stepT          eased 0..1 per step (0 pending, 1 locked)
 *   rawStepT       un-eased 0..1 per step
 *   activeIndices  steps currently mid-morph (0 < raw < 1)
 *   lockedCount    steps fully settled
 *   currentStep    index of the step ON SCREEN (intro → 0, outro → last)
 *   stepLocalT     0..1 position inside the current step's FULL window —
 *                  drives the narration typewriter (distinct from stepT,
 *                  which stops moving at lockAt)
 */
export function resolveBreakdownProgress(
  schedule, progression, easingFn
) {
  const p = wrapProgression( progression );
  const {
    introEnd,
    outroStart,
    windows
  } = schedule;

  const ease = typeof easingFn === "function" ? easingFn : ( x ) => x;

  let phase = "build";
  let phaseT = 0;

  if ( p < introEnd ) {
    phase = "intro";
    phaseT = introEnd > 0 ? p / introEnd : 1;
  } else if ( p >= outroStart ) {
    phase = "outro";
    phaseT = outroStart < 1 ? ( p - outroStart ) / ( 1 - outroStart ) : 1;
  } else {
    const span = outroStart - introEnd;

    phaseT = span > 0 ? ( p - introEnd ) / span : 1;
  }

  const stepT = [];
  const rawStepT = [];
  const activeIndices = [];

  let lockedCount = 0;

  windows.forEach( (
    window, index
  ) => {
    let raw;

    if ( phase === "intro" ) {
      raw = 0;
    } else if ( phase === "outro" ) {
      raw = 1;
    } else {
      const moveSpan = window.lockAt - window.start;

      raw = moveSpan > 0
        ? clamp01( ( p - window.start ) / moveSpan )
        : ( p >= window.start ? 1 : 0 );
    }

    if ( raw >= 1 ) {
      lockedCount += 1;
    } else if ( raw > 0 ) {
      activeIndices.push( index );
    }

    rawStepT.push( raw );
    stepT.push( raw <= 0 ? 0 : raw >= 1 ? 1 : clamp01( ease( raw ) ) );
  } );

  // Which step the overlay narrates right now. Windows tile the build span,
  // so during build it's a plain floor over the build-local position; the
  // intro previews step 0 and the outro pins the last step (fading out).
  let currentStep = 0;
  let stepLocalT = 0;

  if ( windows.length ) {
    if ( phase === "intro" ) {
      currentStep = 0;
      stepLocalT = 0;
    } else if ( phase === "outro" ) {
      currentStep = windows.length - 1;
      stepLocalT = 1;
    } else {
      currentStep = Math.min(
        windows.length - 1,
        Math.floor( phaseT * windows.length )
      );

      const window = windows[ currentStep ];
      const span = window.end - window.start;

      stepLocalT = span > 0 ? clamp01( ( p - window.start ) / span ) : 1;
    }
  }

  return {
    phase,
    phaseT: clamp01( phaseT ),
    stepT,
    rawStepT,
    activeIndices,
    lockedCount,
    currentStep,
    stepLocalT
  };
}
