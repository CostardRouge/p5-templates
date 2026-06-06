/**
 * @jest-environment jsdom
 */

/**
 * Integration tests for the GSAP/HTML photo templates.
 *
 * These drive the real template + GSAP pipeline in jsdom: each template is
 * rendered, its `useTimeline` builder is captured (via the runtime), and the
 * resulting paused timeline is scrubbed exactly like the engine does for
 * deterministic capture. We then assert two things every looping template must
 * guarantee:
 *
 *   1. It animates — at least one element's inline style changes mid-loop.
 *   2. It loops seamlessly — the state at the end of the loop matches the
 *      state at the start, so playback wraps without a visible jump.
 */
import React from "react";
import {
  render, cleanup
} from "@testing-library/react";
import gsap from "gsap";

// The `.jsx` templates rely on the automatic JSX runtime (as Next.js provides)
// and don't import React. ts-jest here uses the classic runtime, so expose
// React globally for their `React.createElement` calls.
( globalThis as any ).React = React;

import runtime, {
  RuntimeContext
} from "@/gsap/utils/runtime";

import GridCascade from "@/gsap/sketches/photo/grid-cascade/index.jsx";
import Coverflow3d from "@/gsap/sketches/photo/coverflow-3d/index.jsx";
import StackShuffle from "@/gsap/sketches/photo/stack-shuffle/index.jsx";

const DURATION = 6;

function baseOptions( sketch: Record<string, any> ) {
  return {
    id: null,
    size: {
      width: 1080,
      height: 1350
    },
    animation: {
      framerate: 60,
      duration: DURATION
    },
    sketch: {
      images: [
        "/assets/images/test/a.jpg",
        "/assets/images/test/b.jpg",
        "/assets/images/test/c.jpg",
        "/assets/images/test/d.jpg",
        "/assets/images/test/e.jpg",
        "/assets/images/test/f.jpg"
      ],
      imageFit: "cover",
      cornerRadius: 16,
      gap: 16,
      backgroundColor: [
        10,
        10,
        12
      ],
      ease: "easeInOutCubic",
      imageEffect: {
        grayscale: 0,
        brightness: 1,
        contrast: 1,
        saturate: 1,
        blur: 0
      },
      shadow: {
        enabled: true,
        blur: 40,
        opacity: 0.35,
        y: 24
      },
      ...sketch
    }
  };
}

/**
 * Render a template, capture the timeline builder it registers, and return a
 * freshly-built paused timeline plus the scoped stage element.
 */
function buildTimeline(
  Component: React.ComponentType<{ options: Record<string, any> }>,
  options: Record<string, any>
) {
  const stage = document.createElement( "div" );

  document.body.appendChild( stage );

  let builder: ( ( args: any ) => void ) | null = null;
  const spy = jest
    .spyOn(
      runtime,
      "registerTimeline"
    )
    .mockImplementation( ( build: any ) => {
      builder = build;
    } );

  render(
    <RuntimeContext.Provider
      value={ {
        version: 0,
        options
      } }
    >
      <Component options={ options } />
    </RuntimeContext.Provider>,
    {
      container: stage
    }
  );

  spy.mockRestore();

  if ( !builder ) {
    throw new Error( "Template did not register a timeline." );
  }

  const tl = gsap.timeline( {
    paused: true
  } );

  // Scope selectors to the stage, mirroring the runtime's gsap.context().
  const ctx = gsap.context(
    () => builder!( {
      tl,
      gsap,
      root: stage,
      options
    } ),
    stage
  );

  return {
    tl,
    stage,
    ctx
  };
}

/** Snapshot the animatable inline styles of a set of elements. */
function snapshot( elements: Element[] ) {
  return elements.map( ( el ) => {
    const style = ( el as HTMLElement ).style;

    return [
      style.transform,
      style.opacity,
      style.clipPath
    ].join( "|" );
  } );
}

afterEach( () => {
  cleanup();
  document.body.innerHTML = "";
} );

describe(
  "GSAP photo templates",
  () => {
    const cases: Array<{
      name: string;
      Component: React.ComponentType<{ options: Record<string, any> }>;
      options: Record<string, any>;
      selector: string;
      seamless?: ( stage: HTMLElement, tl: gsap.core.Timeline ) => void;
    }> = [
      {
        name: "grid-cascade",
        Component: GridCascade,
        options: baseOptions( {
          grid: {
            rows: 3,
            columns: 3
          }
        } ),
        selector: ".gc-cell"
      },
      {
        name: "coverflow-3d",
        Component: Coverflow3d,
        options: baseOptions( {
          count: 6
        } ),
        selector: ".cf-ring",
        // The ring spins whole turns, so the transform string differs
        // (rotateY(-360deg)) while being visually identical. Assert it rotated
        // and landed on a whole number of turns instead.
        seamless: (
          stage, tl
        ) => {
          const ring = stage.querySelector( ".cf-ring" ) as HTMLElement;

          tl.time( tl.duration() * 0.5 );
          const midRotation = gsap.getProperty(
            ring,
            "rotationY"
          ) as number;

          tl.time( tl.duration() );
          const endRotation = gsap.getProperty(
            ring,
            "rotationY"
          ) as number;

          expect( Math.abs( midRotation ) ).toBeGreaterThan( 0 );
          expect( ( ( endRotation % 360 ) + 360 ) % 360 ).toBeCloseTo(
            0,
            3
          );
        }
      },
      {
        name: "stack-shuffle",
        Component: StackShuffle,
        options: baseOptions( {
          maxCards: 5
        } ),
        selector: ".ss-card"
      }
    ];

    it.each( cases )(
      "$name builds a timeline that fills the loop duration",
      ( {
        Component, options
      } ) => {
        const {
          tl, ctx
        } = buildTimeline(
          Component,
          options
        );

        expect( tl.duration() ).toBeGreaterThan( 0 );
        expect( tl.duration() ).toBeCloseTo(
          DURATION,
          1
        );

        ctx.revert();
      }
    );

    it.each( cases )(
      "$name animates across the loop",
      ( {
        Component, options, selector
      } ) => {
        const {
          tl, stage, ctx
        } = buildTimeline(
          Component,
          options
        );
        const targets = Array.from( stage.querySelectorAll( selector ) );

        expect( targets.length ).toBeGreaterThan( 0 );

        // Render mid first, then start: GSAP only flushes styles when the
        // playhead time actually changes, so going 0.5 → 0 forces both renders.
        tl.time( DURATION * 0.5 );
        const atMid = snapshot( targets );

        tl.time( 0 );
        const atStart = snapshot( targets );

        expect( atMid ).not.toEqual( atStart );

        ctx.revert();
      }
    );

    it.each( cases )(
      "$name loops seamlessly (end state matches start state)",
      ( {
        Component, options, selector, seamless
      } ) => {
        const {
          tl, stage, ctx
        } = buildTimeline(
          Component,
          options
        );

        if ( seamless ) {
          seamless(
            stage,
            tl
          );
          ctx.revert();

          return;
        }

        const targets = Array.from( stage.querySelectorAll( selector ) );

        // Render the boundary first, then frame 0: going end → 0 forces GSAP to
        // flush both states (it skips re-rendering an unchanged playhead time).
        tl.time( tl.duration() );
        const atEnd = snapshot( targets );

        tl.time( 0 );
        const atStart = snapshot( targets );

        expect( atEnd ).toEqual( atStart );

        ctx.revert();
      }
    );
  }
);
