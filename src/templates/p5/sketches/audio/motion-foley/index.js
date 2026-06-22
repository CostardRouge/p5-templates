import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import audio from "@/p5/utils/audio.js";
import SHAPE_LIBRARY from "./_shapes.js";
import {
  buildSchedule,
  categoryBase,
  categoryLabel,
  CATEGORY_LIST,
  defaultVariant,
  expandForGroup,
  hasRelease
} from "./_soundDesign.js";

/**
 * Motion-foley — a demo gallery that pairs ten shape-animation gestures with
 * reusable, code-synthesised sound effects (see `_soundDesign.js`).
 *
 * Each tile runs a tension → release cycle:
 *
 *   rest → TENSION (the action + its sound) → hold → RELEASE (the resolution +
 *   a distinct, settling sound) → rest → …
 *
 * The shape deforms 0→1 during tension and 1→0 during release, so the gesture
 * physically returns to rest while a *different* sound signals that it has
 * resolved. Release can be switched off per gesture (or globally), for actions
 * that are not meant to resolve. Tiles are staggered around the loop so the
 * gestures answer one another rather than firing all at once.
 */

const state = {
  // category → { cycle, tNext, rNext } — per-tile playhead bookkeeping so each
  // scheduled tension/release event fires exactly once per loop.
  fire: {}
};

function clamp01( value ) {
  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  );
}

function positiveMod(
  value, modulus
) {
  return ( ( value % modulus ) + modulus ) % modulus;
}

/** Minimal HSL → [ r, g, b ] (0..255) so spectrum coloring needs no p5 state. */
function hslToRgb(
  h, s, l
) {
  const c = ( 1 - Math.abs( 2 * l - 1 ) ) * s;
  const hp = positiveMod(
    h,
    360
  ) / 60;
  const x = c * ( 1 - Math.abs( hp % 2 - 1 ) );
  let r = 0;
  let g = 0;
  let b = 0;

  if ( hp < 1 ) {
    r = c;
    g = x;
  } else if ( hp < 2 ) {
    r = x;
    g = c;
  } else if ( hp < 3 ) {
    g = c;
    b = x;
  } else if ( hp < 4 ) {
    g = x;
    b = c;
  } else if ( hp < 5 ) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = l - c / 2;

  return [
    Math.round( ( r + m ) * 255 ),
    Math.round( ( g + m ) * 255 ),
    Math.round( ( b + m ) * 255 )
  ];
}

function tileColor(
  appearance, index, total, itemShift
) {
  if ( ( appearance.colorMode ?? "spectrum" ) === "mono" ) {
    return appearance.baseColor ?? [
      255,
      255,
      255
    ];
  }

  const hue = ( index / Math.max(
    1,
    total
  ) ) * 320 + itemShift * 22;

  return hslToRgb(
    hue,
    0.7,
    0.62
  );
}

/** Deformation (0..1) at `local`, with an optional per-item `delay` (seconds). */
function deformAt(
  local, delay, tDur, hold, rDur
) {
  const rStart = tDur + hold;

  if ( local < rStart ) {
    return clamp01( ( local - delay ) / tDur );
  }

  if ( rDur > 0 && local < rStart + rDur ) {
    return 1 - clamp01( ( local - rStart - delay ) / rDur );
  }

  return 0;
}

sketch.setup( () => {
  state.fire = {};
} );

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const layout = o.layout ?? {};
  const timing = o.timing ?? {};
  const group = o.group ?? {};
  const audioOptions = o.audio ?? {};
  const appearance = o.appearance ?? {};
  const tensionRelease = o.tensionRelease ?? {};

  const tDur = Math.max(
    0.2,
    timing.animationDuration ?? 1.4
  );
  const restDuration = Math.max(
    0,
    timing.restDuration ?? 0.6
  );
  const trEnabled = tensionRelease.enabled !== false;
  const holdOpt = Math.max(
    0,
    tensionRelease.hold ?? 0.25
  );
  const releaseDurationOpt = Math.max(
    0.1,
    tensionRelease.releaseDuration ?? 1
  );
  const count = Math.max(
    1,
    Math.round( group.count ?? 1 )
  );
  const groupSettings = {
    count,
    mode: group.mode ?? "unison",
    spread: group.spread ?? 0.5,
    sequenceSpread: group.sequenceSpread ?? 0.5
  };

  const tiles = CATEGORY_LIST.filter( ( category ) => ( o[ category ]?.enabled ?? true ) );

  p.clear();
  p.background( ...( appearance.background ?? [
    10,
    10,
    16
  ] ) );

  if ( tiles.length === 0 ) {
    return;
  }

  if ( audioOptions.enabled !== false ) {
    audio.setVolume( audioOptions.masterVolume ?? 0.8 );
  }

  const columns = ( layout.columns ?? 0 ) > 0
    ? Math.round( layout.columns )
    : Math.ceil( Math.sqrt( tiles.length ) );
  const rows = Math.ceil( tiles.length / columns );
  const cellW = p.width / columns;
  const cellH = p.height / rows;
  const baseSize = Math.min(
    cellW,
    cellH
  ) * 0.34 * ( layout.shapeScale ?? 1 );
  const showLabels = layout.showLabels !== false;
  const staggerSpread = timing.stagger === false
    ? 0
    : ( timing.staggerSpread ?? 1 );
  const audioEnabled = audioOptions.enabled !== false;
  const arpeggio = groupSettings.mode === "arpeggio";

  tiles.forEach( (
    category, index
  ) => {
    const tileOptions = o[ category ] ?? {};
    const variant = tileOptions.variant ?? defaultVariant(
      category,
      "tension"
    );
    const releaseVariant = tileOptions.releaseVariant ?? defaultVariant(
      category,
      "release"
    );
    const pitch = tileOptions.pitch ?? 1;
    const tileVolume = tileOptions.volume ?? 1;

    const releaseActive = trEnabled
      && tileOptions.release !== false
      && hasRelease( category );
    const hold = releaseActive ? holdOpt : 0;
    const rDur = releaseActive ? releaseDurationOpt : 0;
    const period = tDur + hold + rDur + restDuration;

    // ── Playhead for this tile ───────────────────────────────────────────────
    const offset = ( index / tiles.length ) * period * staggerSpread;
    const shifted = time - offset;
    const cycle = Math.floor( shifted / period );
    const local = positiveMod(
      shifted,
      period
    );
    const rStart = tDur + hold;
    const phase = local < tDur
      ? "tension"
      : local < rStart
        ? "hold"
        : ( rDur > 0 && local < rStart + rDur ) ? "release" : "rest";

    // ── Audio: build the two schedules once, fire each event as it is crossed ─
    const tuning = {
      base: categoryBase( category ) * pitch,
      gain: audioOptions.gain ?? 0.5
    };
    const tensionSchedule = expandForGroup(
      buildSchedule(
        category,
        "tension",
        variant,
        tDur,
        tuning
      ),
      groupSettings
    );
    const releaseSchedule = releaseActive
      ? expandForGroup(
        buildSchedule(
          category,
          "release",
          releaseVariant,
          rDur,
          tuning
        ),
        groupSettings
      )
      : [];

    const fireState = state.fire[ category ] ?? {
      cycle: null,
      tNext: 0,
      rNext: 0
    };

    if ( fireState.cycle !== cycle ) {
      fireState.cycle = cycle;
      fireState.tNext = 0;
      fireState.rNext = 0;
    }

    while (
      fireState.tNext < tensionSchedule.length
      && tensionSchedule[ fireState.tNext ].at * tDur <= local
    ) {
      const event = tensionSchedule[ fireState.tNext ];

      if ( audioEnabled && local <= tDur + 0.06 ) {
        audio.trigger(
          event.name,
          {
            ...event.params,
            gain: ( event.params.gain ?? 0.5 ) * tileVolume
          }
        );
      }

      fireState.tNext++;
    }

    const releaseLocal = local - rStart;

    while (
      fireState.rNext < releaseSchedule.length
      && releaseLocal >= 0
      && releaseSchedule[ fireState.rNext ].at * rDur <= releaseLocal
    ) {
      const event = releaseSchedule[ fireState.rNext ];

      if ( audioEnabled && releaseLocal <= rDur + 0.06 ) {
        audio.trigger(
          event.name,
          {
            ...event.params,
            gain: ( event.params.gain ?? 0.5 ) * tileVolume
          }
        );
      }

      fireState.rNext++;
    }

    state.fire[ category ] = fireState;

    // ── Visuals ──────────────────────────────────────────────────────────────
    const col = index % columns;
    const row = Math.floor( index / columns );
    const cx = ( col + 0.5 ) * cellW;
    const cy = ( row + 0.5 ) * cellH - ( showLabels ? cellH * 0.06 : 0 );
    const draw = SHAPE_LIBRARY[ category ];
    const itemSize = count > 1 ? baseSize * 0.62 : baseSize;
    const gap = itemSize * 1.2;

    for ( let k = 0; k < count; k++ ) {
      const spreadT = count > 1 ? k / ( count - 1 ) : 0;
      const itemCx = cx + ( k - ( count - 1 ) / 2 ) * gap;
      const delay = arpeggio
        ? spreadT * groupSettings.sequenceSpread * tDur
        : 0;
      const itemProgress = deformAt(
        local,
        delay,
        tDur,
        hold,
        rDur
      );

      p.push();
      draw(
        p,
        {
          progress: itemProgress,
          phase,
          time,
          cx: itemCx,
          cy,
          size: itemSize,
          color: tileColor(
            appearance,
            index,
            tiles.length,
            spreadT
          ),
          seed: index * 7 + k
        }
      );
      p.pop();
    }

    // ── Label ────────────────────────────────────────────────────────────────
    if ( showLabels ) {
      p.push();
      p.noStroke();
      p.fill(
        220,
        220,
        230,
        phase === "rest" ? 120 : 235
      );
      p.textAlign(
        p.CENTER,
        p.CENTER
      );
      p.textSize( Math.max(
        10,
        Math.min(
          cellW,
          cellH
        ) * 0.07
      ) );
      p.text(
        categoryLabel( category ),
        cx,
        ( row + 1 ) * cellH - cellH * 0.12
      );
      p.pop();
    }
  } );
} );
