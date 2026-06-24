/**
 * @jest-environment jsdom
 *
 * "Setting the duration works" for GSAP templates.
 *
 * A GSAP template builds a paused timeline scaled to `options.animation.duration`
 * (the runtime then scrubs it by frame). If a template hard-codes its tween
 * lengths the loop would finish early and freeze for the rest of the loop —
 * exactly the "duration doesn't work" symptom. These tests build each
 * template's timeline at two different durations and assert the total timeline
 * length tracks the configured duration.
 */
import React from "react";
import {
  render, cleanup
} from "@testing-library/react";
import gsap from "gsap";

// The `.jsx` templates use the classic runtime here and don't import React.
( globalThis as any ).React = React;

import runtime, {
  RuntimeContext
} from "@/gsap/utils/runtime";

import HelloGsap from "@/gsap/sketches/hello-gsap/index.jsx";
import KenBurnsFrame from "@/gsap/sketches/photo/ken-burns-frame/index.jsx";

function baseOptions(
  duration: number,
  sketch: Record<string, any> = {}
) {
  return {
    id: null,
    size: {
      width: 1080,
      height: 1350
    },
    animation: {
      framerate: 60,
      duration
    },
    sketch: {
      images: [
        "/assets/images/test/a.jpg"
      ],
      ...sketch
    }
  };
}

/** Render a template, capture the timeline builder, return a built timeline. */
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
    <RuntimeContext.Provider value={ {
      version: 0,
      options
    } }>
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

afterEach( () => {
  cleanup();
  document.body.innerHTML = "";
} );

const TEMPLATES: Array<{ name: string;
  Component: React.ComponentType<{ options: Record<string, any> }> }> = [
  {
    name: "hello-gsap",
    Component: HelloGsap
  },
  {
    name: "ken-burns-frame",
    Component: KenBurnsFrame
  }
];

describe(
  "GSAP templates honor the animation duration",
  () => {
    test.each( TEMPLATES )(
      "$name: timeline length scales with the configured duration",
      ( {
        Component
      } ) => {
        const short = buildTimeline(
          Component,
          baseOptions( 4 )
        );
        const long = buildTimeline(
          Component,
          baseOptions( 16 )
        );

        const shortLen = short.tl.duration();
        const longLen = long.tl.duration();

        short.ctx.revert();
        long.ctx.revert();

        // The loop length must fill (approximately) the configured duration,
        // not a hard-coded constant.
        expect( shortLen ).toBeCloseTo(
          4,
          1
        );
        expect( longLen ).toBeCloseTo(
          16,
          1
        );

        // And it must actually grow with the duration (guards against a tween
        // capped at some fixed maximum).
        expect( longLen ).toBeGreaterThan( shortLen + 1 );
      }
    );
  }
);
