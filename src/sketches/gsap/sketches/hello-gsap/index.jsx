"use client";

/**
 * Demo GSAP/HTML template — kinetic headline.
 *
 * Shows the engine contract end to end:
 *   • A plain React/JSX DOM structure driven by `options.sketch`.
 *   • A paused GSAP timeline registered with `useTimeline`; the engine scrubs
 *     it by frame, so playback, scrubbing and recording are all deterministic.
 *
 * Selectors inside the timeline builder are auto-scoped to the stage by the
 * runtime's `gsap.context`, so `.hg-word` only matches this template's nodes.
 */
import {
  useTimeline, gsap, toWords, toCssColor
} from "@/gsap/utils";

const FONT_STACK =
  "'Helvetica Neue', Helvetica, Arial, system-ui, -apple-system, sans-serif";

export default function HelloGsap( {
  options
} ) {
  const sketch = options?.sketch ?? {};

  const headline = sketch.headline ?? "Made with GSAP";
  const subtitle = sketch.subtitle ?? "HTML · CSS · GSAP — recorded frame-perfect";
  const headlineSize = sketch.headlineSize ?? 132;

  const background = toCssColor(
    sketch.backgroundColor,
    "#0b0b12"
  );
  const textColor = toCssColor(
    sketch.textColor,
    "#ffffff"
  );
  const accent = toCssColor(
    sketch.accentColor,
    "#7c5cff"
  );

  const words = toWords( headline );

  useTimeline(
    ( {
      tl, options: opts
    } ) => {
      // Loop length == the animation duration. The intro is sized relative to
      // it so the whole reveal (orb → words → subtitle) always fits inside the
      // loop — even at 1s — instead of using hardcoded seconds. `k` keeps the
      // comfortable ~2.2s design pacing for normal durations and compresses it
      // proportionally for short ones.
      const loop = opts?.animation?.duration ?? 12;
      const introSpan = Math.min(
        loop * 0.85,
        2.2
      );
      const k = introSpan / 2.2;

      tl.set(
        ".hg-word",
        {
          yPercent: 120,
          opacity: 0
        }
      );
      tl.set(
        ".hg-subtitle",
        {
          opacity: 0,
          y: 24
        }
      );
      tl.set(
        ".hg-orb",
        {
          scale: 0.6,
          opacity: 0
        }
      );

      // Intro (durations + positions scaled by `k` to fit the loop)
      tl.to(
        ".hg-orb",
        {
          scale: 1,
          opacity: 1,
          duration: 1.2 * k,
          ease: "power2.out"
        },
        0
      );
      tl.to(
        ".hg-word",
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.9 * k,
          ease: "power4.out",
          stagger: 0.12 * k
        },
        0.2 * k
      );
      tl.to(
        ".hg-subtitle",
        {
          opacity: 1,
          y: 0,
          duration: 0.8 * k,
          ease: "power2.out"
        },
        0.75 * k
      );

      // Ambient: one full orb rotation spread across the whole loop. Ending at
      // 360° (≡ 0°) means it lines up perfectly when the loop wraps to the start.
      tl.to(
        ".hg-orb",
        {
          rotation: 360,
          duration: loop,
          ease: "none"
        },
        0
      );
    },
    [
      headline,
      subtitle,
      headlineSize
    ]
  );

  return (
    <div
      className="hg-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        color: textColor,
        fontFamily: FONT_STACK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      } }
    >
      <div
        className="hg-orb"
        style={ {
          position: "absolute",
          top: "38%",
          left: "50%",
          width: 620,
          height: 620,
          marginLeft: -310,
          marginTop: -310,
          borderRadius: "50%",
          background: `radial-gradient(circle at 32% 30%, ${ accent }, transparent 68%)`,
          filter: "blur(6px)",
          pointerEvents: "none"
        } }
      />

      <h1
        className="hg-headline"
        style={ {
          position: "relative",
          margin: 0,
          padding: "0 8%",
          fontSize: headlineSize,
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: "-0.01em",
          textAlign: "center",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 0.28em"
        } }
      >
        { words.map( (
          word, index
        ) => (
          <span
            key={ index }
            className="hg-word-wrap"
            style={ {
              display: "inline-block",
              overflow: "hidden",
              paddingBottom: "0.12em"
            } }
          >
            <span
              className="hg-word"
              style={ {
                display: "inline-block"
              } }
            >
              { word }
            </span>
          </span>
        ) ) }
      </h1>

      <p
        className="hg-subtitle"
        style={ {
          position: "relative",
          marginTop: 40,
          padding: "0 12%",
          fontSize: Math.round( headlineSize * 0.26 ),
          fontWeight: 500,
          opacity: 0.82,
          textAlign: "center"
        } }
      >
        { subtitle }
      </p>
    </div>
  );
}
