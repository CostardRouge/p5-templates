import string from "../../string.js";
import sketch, {
  getP5
} from "../../sketch.js";
import animation from "../../animation.js";
import time from "../../time.js";
import buildSpecsLines from "./specsData.js";
import computeSpecsHeats from "./specsChanges.js";
import specsSound from "./specsSound.js";
import {
  reportItemBounds
} from "./itemBoundsRegistry.js";

/**
 * Technical / BIOS-style overlay that reveals the current sketch settings.
 *
 * Two layout styles (specsOption.style):
 *   - "boot-log": lines stream in top-down with a per-character typewriter on
 *     the line currently being typed, plus a blinking cursor (boot sequence).
 *   - "ticker": a single line shows one parameter at a time and cycles through
 *     all of them.
 *
 * Visibility (specsOption.visibility.mode):
 *   - "fade": reveal -> hold -> fade-out across the loop via revealEnd/holdEnd/
 *     fadeEnd. Past fadeEnd nothing is drawn (plays once, then disappears).
 *   - "permanent": always fully visible, no fade.
 *
 * Highlight on change (specsOption.highlight.style): whichever line just changed
 * is emphasised temporarily, fading over highlight.duration seconds. Styles:
 * "invert" (NGE bar), "pulse", "pastille", "underline", or "off".
 */
export default function drawSlideSpecs( specsOption ) {
  const p = getP5();
  const progress = animation.progression;

  const visibility = specsOption.visibility ?? {
    mode: "fade",
    revealEnd: 0.45,
    holdEnd: 0.7,
    fadeEnd: 0.8
  };
  const mode = visibility.mode ?? "fade";

  // Resolve fade timing -> overlay alpha (0..255) and reveal fraction (0..1).
  let alpha = 255;
  let revealAmount = 1;

  if ( mode === "fade" ) {
    const revealEnd = visibility.revealEnd ?? 0.45;
    const holdEnd = visibility.holdEnd ?? 0.7;
    const fadeEnd = visibility.fadeEnd ?? 0.8;

    // Past the fade window the overlay is gone.
    if ( progress >= fadeEnd ) {
      return;
    }

    if ( progress >= holdEnd ) {
      alpha = p.map(
        progress,
        holdEnd,
        fadeEnd,
        255,
        0,
        true
      );
    }

    revealAmount = revealEnd > 0 ? p.constrain(
      progress / revealEnd,
      0,
      1
    ) : 1;
  }

  const lines = buildSpecsLines( specsOption );

  if ( !lines.length ) {
    return;
  }

  // Per-line change heat (0..1), only when a highlight effect is active.
  const highlight = specsOption.highlight ?? {
    style: "invert",
    duration: 0.9,
    background: specsOption.fill
  };
  const highlightActive = Boolean( highlight.style ) && highlight.style !== "off";
  const highlightDuration = highlight.duration ?? 0.9;

  // Sound on change rides the same change tracker as the highlight, so it
  // works with the highlight off too. Single computeSpecsHeats call per frame:
  // the tracker mutates on read, so a second call would swallow the change.
  const sound = specsOption.sound;
  const soundEnabled = Boolean( sound?.enabled );
  const changedLines = [];

  let heats = null;

  if ( highlightActive || soundEnabled ) {
    const computed = computeSpecsHeats(
      lines,
      highlightDuration,
      soundEnabled
        ? (
          label, index
        ) => changedLines.push( {
          label,
          index
        } )
        : undefined
    );

    heats = highlightActive ? computed : null;
  }

  if ( soundEnabled ) {
    const now = time.seconds();

    for ( const change of changedLines ) {
      specsSound.noteChange(
        sound,
        {
          ...change,
          lineCount: lines.length,
          now,
          highlightDuration
        }
      );
    }

    specsSound.update( now );
  }

  const size = specsOption.size ?? 22;
  const lineStep = size * ( specsOption.lineHeight ?? 1.4 );
  const font = string.fonts?.[ specsOption.font ] ?? string.fonts.spaceMonoRegular;

  const baseFill = p.color( ...specsOption.fill );

  baseFill.setAlpha( alpha );

  const textStyle = {
    size,
    font,
    stroke: false,
    strokeWeight: 0,
    blendMode: specsOption.blend,
    textWidth: -1,
    textAlign: [
      p.LEFT,
      p.TOP
    ]
  };

  const measureWidth = ( text ) => {
    p.push();
    p.textFont( font );
    p.textSize( size );
    const w = p.textWidth( text );

    p.pop();

    return w;
  };

  const writeLine = (
    text, x, y, fill = baseFill
  ) => {
    string.write(
      text,
      x,
      y,
      {
        ...textStyle,
        fill
      }
    );
  };

  // Draw one fully-revealed line with the configured highlight effect applied
  // proportionally to its heat (0 = settled, 1 = just changed).
  const drawLine = (
    text, x, y, heat
  ) => {
    if ( !heats || heat <= 0 || highlight.style === "off" ) {
      writeLine(
        text,
        x,
        y
      );

      return;
    }

    const accent = () => p.color( ...specsOption.fill );

    // Black or white, whichever reads best on top of the given colour.
    const contrastOf = ( color ) => {
      const luminance =
        0.299 * p.red( color ) +
        0.587 * p.green( color ) +
        0.114 * p.blue( color );

      return luminance > 140 ? p.color(
        0,
        0,
        0
      ) : p.color(
        255,
        255,
        255
      );
    };

    // Inverted-bar flash: a coloured bar behind the line with auto-contrasting
    // text. Shared by the "invert" and "blink" styles.
    const drawInvertedFlash = (
      flashText, flashX, flashY, intensity
    ) => {
      const w = measureWidth( flashText );
      const padX = size * 0.18;
      const padTop = size * 0.15;
      // Extra room below so descenders (g, p, y, ...) stay inside the bar.
      const padBottom = size * 0.4;
      const background = p.color( ...( highlight.background ?? specsOption.fill ) );
      const bar = p.color(
        p.red( background ),
        p.green( background ),
        p.blue( background )
      );

      bar.setAlpha( intensity * alpha );

      p.push();
      p.blendMode( p.BLEND );
      p.noStroke();
      p.fill( bar );
      p.rect(
        flashX - padX,
        flashY - padTop,
        w + padX * 2,
        size + padTop + padBottom
      );
      p.pop();

      // Text crossfades from its normal fill to whatever reads on the bar.
      const txt = p.lerpColor(
        accent(),
        contrastOf( background ),
        intensity
      );

      txt.setAlpha( alpha );
      writeLine(
        flashText,
        flashX,
        flashY,
        txt
      );
    };

    switch ( highlight.style ) {
      case "invert": {
        drawInvertedFlash(
          text,
          x,
          y,
          heat
        );

        return;
      }

      case "blink": {
        // Square-wave flash on the real clock, so frequency is a true Hz value
        // independent of the loop length (macOS menu-bar style). Full strength,
        // no fade: the change window (heat > 0) just gates how long it blinks.
        const frequency = highlight.frequency ?? 6;
        const on = ( performance.now() / 1000 * frequency ) % 1 < 0.5;

        if ( on ) {
          drawInvertedFlash(
            text,
            x,
            y,
            1
          );
        } else {
          writeLine(
            text,
            x,
            y
          );
        }

        return;
      }

      case "pulse": {
        const txt = p.lerpColor(
          accent(),
          p.color(
            255,
            255,
            255
          ),
          heat * 0.85
        );

        txt.setAlpha( alpha );
        writeLine(
          text,
          x,
          y,
          txt
        );

        return;
      }

      case "pastille": {
        writeLine(
          text,
          x,
          y
        );

        const dot = accent();

        dot.setAlpha( heat * alpha );

        const dotY = y + size * 0.5 + ( highlight.pastilleOffset ?? 0 ) * size;

        p.push();
        p.blendMode( p.BLEND );
        p.noStroke();
        p.fill( dot );
        p.circle(
          x - size * 0.45,
          dotY,
          size * 0.32
        );
        p.pop();

        return;
      }

      case "underline": {
        writeLine(
          text,
          x,
          y
        );

        const w = measureWidth( text );
        const ul = accent();

        ul.setAlpha( heat * alpha );

        // Base sits just under the text; a negative offset walks it up onto the
        // glyphs for a strike-through look.
        const lineY = y + size + ( highlight.underlineOffset ?? 0 ) * size;

        p.push();
        p.blendMode( p.BLEND );
        p.stroke( ul );
        p.strokeWeight( Math.max(
          1,
          size * 0.07
        ) );
        p.line(
          x,
          lineY,
          x + w,
          lineY
        );
        p.pop();

        return;
      }

      default:
        writeLine(
          text,
          x,
          y
        );
    }
  };

  // Blinking cursor character (toggles a few times per loop).
  const cursorVisible =
    specsOption.showCursor && animation.sinOscillation( 6 ) > 0;
  const cursor = cursorVisible ? "_" : "";

  p.push();
  if ( sketch.sketchOptions?.type === "webgl" ) {
    p.translate(
      -p.width / 2,
      -p.height / 2
    );
  }

  const originX = p.width * ( specsOption.position?.x ?? 0.05 );
  const originY = p.height * ( specsOption.position?.y ?? 0.06 );

  // Approximate drawn block (origin, stacked lines) for the on-canvas drag's
  // hit-test. Ticker style shows one line, boot-log all of them — the full
  // block is a generous, stable grab zone for both.
  if ( lines.length > 0 ) {
    const blockW = Math.max(
      ...lines.map( ( line ) => measureWidth( `${ line.label }: ${ line.value }` ) ),
      size * 4
    );

    reportItemBounds(
      originX,
      originY - size,
      blockW,
      lines.length * lineStep + size * 2
    );
  }

  if ( specsOption.style === "ticker" ) {
    // Single line cycling through all parameters. In permanent mode the reveal
    // fraction is pinned to 1, so drive cycling off the loop progression.
    const tickerPhase = mode === "permanent" ? progress : revealAmount;
    const index = Math.min(
      Math.floor( tickerPhase * lines.length ),
      lines.length - 1
    );
    const line = lines[ index ];
    const heat = heats ? heats.get( line.label ) ?? 0 : 0;

    drawLine(
      `${ line.label }: ${ line.value }${ cursor }`,
      originX,
      originY,
      heat
    );

    p.pop();

    return;
  }

  // Default "boot-log" style: stream lines in top-down with typewriter.
  const exactLines = revealAmount * lines.length;
  const fullyVisible = Math.floor( exactLines );
  const typingFraction = exactLines - fullyVisible;

  for ( let i = 0; i < lines.length; i++ ) {
    if ( i > fullyVisible ) {
      break;
    }

    const line = lines[ i ];
    const full = `${ line.label }: ${ line.value }`;
    const y = originY + i * lineStep;

    if ( i < fullyVisible ) {
      const heat = heats ? heats.get( line.label ) ?? 0 : 0;

      drawLine(
        full,
        originX,
        y,
        heat
      );

      continue;
    }

    // Line currently being typed: reveal character by character (no highlight).
    const visibleCount = Math.ceil( full.length * typingFraction );
    const typed = full.slice(
      0,
      visibleCount
    );

    writeLine(
      `${ typed }${ cursor }`,
      originX,
      y
    );
  }

  p.pop();
}
