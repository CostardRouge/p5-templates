/**
 * Tests for photo-exif template animations
 * Validates animation timing and synchronization with different framerates
 */

import gsap from "gsap";
import fc from "fast-check";
import {
  calculateTotalFrames,
  calculateProgress,
  dispatchSeekFrame,
  setupFrameSync,
} from "@/lib/gsap/syncWithRecording";
import type {
  PhotoExifTemplateOptions
} from "../types";
import {
  defaultOptions
} from "../options";

describe(
  "Photo EXIF Template Animations",
  () => {
    beforeEach( () => {
    // Reset GSAP state before each test
      gsap.globalTimeline.clear();
    } );

    afterEach( () => {
    // Clean up after each test
      gsap.killTweensOf( "*" );
    } );

    describe(
      "Animation timing at different framerates",
      () => {
        it(
          "should complete animation at correct frame count for 24fps",
          () => {
            const options: PhotoExifTemplateOptions = {
              ...defaultOptions,
              animation: {
                duration: 5,
                framerate: 24,
              },
            };

            const expectedFrames = calculateTotalFrames( options.animation );

            expect( expectedFrames ).toBe( 120 ); // 5 seconds * 24 fps
          }
        );

        it(
          "should complete animation at correct frame count for 30fps",
          () => {
            const options: PhotoExifTemplateOptions = {
              ...defaultOptions,
              animation: {
                duration: 5,
                framerate: 30,
              },
            };

            const expectedFrames = calculateTotalFrames( options.animation );

            expect( expectedFrames ).toBe( 150 ); // 5 seconds * 30 fps
          }
        );

        it(
          "should complete animation at correct frame count for 60fps",
          () => {
            const options: PhotoExifTemplateOptions = {
              ...defaultOptions,
              animation: {
                duration: 5,
                framerate: 60,
              },
            };

            const expectedFrames = calculateTotalFrames( options.animation );

            expect( expectedFrames ).toBe( 300 ); // 5 seconds * 60 fps
          }
        );

        it(
          "should handle fractional durations correctly",
          () => {
            const options: PhotoExifTemplateOptions = {
              ...defaultOptions,
              animation: {
                duration: 2.5,
                framerate: 30,
              },
            };

            const expectedFrames = calculateTotalFrames( options.animation );

            expect( expectedFrames ).toBe( 75 ); // 2.5 seconds * 30 fps
          }
        );
      }
    );

    describe(
      "Timeline duration synchronization",
      () => {
        it(
          "should create timeline with correct duration",
          () => {
            const duration = 5;
            const timeline = gsap.timeline( {
              paused: true,
            } );

            timeline.duration( duration );

            expect( timeline.duration() ).toBe( duration );
          }
        );

        it(
          "should maintain duration after adding animations",
          () => {
            const duration = 5;
            const timeline = gsap.timeline( {
              paused: true,
            } );

            // Add some animations
            timeline.to(
              {
              },
              {
                duration: 1,
              }
            );
            timeline.to(
              {
              },
              {
                duration: 2,
              }
            );

            // Set overall duration
            timeline.duration( duration );

            expect( timeline.duration() ).toBe( duration );
          }
        );

        it(
          "should sync progress correctly across different durations",
          () => {
            const durations = [
              1,
              5,
              10,
              30
            ];

            durations.forEach( ( duration ) => {
              const timeline = gsap.timeline( {
                paused: true,
              } );

              timeline.duration( duration );

              // Test progress at 50%
              timeline.progress( 0.5 );
              expect( timeline.progress() ).toBeCloseTo(
                0.5,
                5
              );

              // Test progress at 100%
              timeline.progress( 1 );
              expect( timeline.progress() ).toBe( 1 );

              timeline.kill();
            } );
          }
        );
      }
    );

    describe(
      "Animation phase timing",
      () => {
        it(
          "should calculate correct phase durations",
          () => {
            const duration = 10;

            // Phase 1: Image entrance (0-30% of duration)
            const imageEntranceDuration = duration * 0.3;

            expect( imageEntranceDuration ).toBe( 3 );

            // Phase 2: EXIF reveal start (20% of duration)
            const exifRevealStart = duration * 0.2;

            expect( exifRevealStart ).toBe( 2 );

            // Phase 2: EXIF reveal duration (40% of duration)
            const exifRevealDuration = duration * 0.4;

            expect( exifRevealDuration ).toBe( 4 );
          }
        );

        it(
          "should ensure phases fit within total duration",
          () => {
            const duration = 5;

            const imageEntranceDuration = duration * 0.3;
            const exifRevealStart = duration * 0.2;
            const exifRevealDuration = duration * 0.4;

            // The last phase should end before or at the total duration
            const lastPhaseEnd = exifRevealStart + exifRevealDuration;

            expect( lastPhaseEnd ).toBeLessThanOrEqual( duration );
          }
        );
      }
    );

    describe(
      "GSAP animation properties",
      () => {
        it(
          "should set initial opacity to 0 for image",
          () => {
            // Create a mock element
            const mockElement = document.createElement( "div" );

            mockElement.id = "image";
            document.body.appendChild( mockElement );

            gsap.set(
              "#image",
              {
                opacity: 0,
                scale: 0.95,
              }
            );

            const computedOpacity = gsap.getProperty(
              "#image",
              "opacity"
            );
            const computedScale = gsap.getProperty(
              "#image",
              "scale"
            );

            expect( computedOpacity ).toBe( 0 );
            expect( computedScale ).toBe( 0.95 );

            document.body.removeChild( mockElement );
          }
        );

        it(
          "should animate image to full opacity and scale",
          () => {
            const mockElement = document.createElement( "div" );

            mockElement.id = "image";
            document.body.appendChild( mockElement );

            const timeline = gsap.timeline( {
              paused: true,
            } );

            gsap.set(
              "#image",
              {
                opacity: 0,
                scale: 0.95,
              }
            );
            timeline.to(
              "#image",
              {
                opacity: 1,
                scale: 1,
                duration: 1,
              }
            );

            // Progress to end of animation
            timeline.progress( 1 );

            const finalOpacity = gsap.getProperty(
              "#image",
              "opacity"
            );
            const finalScale = gsap.getProperty(
              "#image",
              "scale"
            );

            expect( finalOpacity ).toBe( 1 );
            expect( finalScale ).toBe( 1 );

            timeline.kill();
            document.body.removeChild( mockElement );
          }
        );
      }
    );

    /**
   * Property-Based Test: Timeline Progress Monotonicity
   * Feature: gsap-html-templates, Property 3: Timeline Progress Monotonicity
   * Validates: Requirements 2.3
   *
   * This property verifies that for any sequence of frame captures,
   * the timeline progress is monotonically increasing from 0 to 1.
   * This ensures that animations always move forward in time during capture.
   */
    describe(
      "Property 3: Timeline Progress Monotonicity",
      () => {
        it(
          "should maintain monotonically increasing progress for any animation configuration",
          () => {
            fc.assert(
              fc.property(
                // Generate random animation options
                fc.record( {
                  duration: fc.float( {
                    min: 0.5,
                    max: 30,
                    noNaN: true,
                  } ),
                  framerate: fc.constantFrom(
                    24,
                    30,
                    60
                  ),
                } ),
                ( animationOptions ) => {
                  // Create a timeline with the generated options
                  const timeline = gsap.timeline( {
                    paused: true,
                  } );

                  timeline.duration( animationOptions.duration );

                  const totalFrames = calculateTotalFrames( animationOptions );
                  const progressValues: number[] = [
                  ];

                  // Simulate frame-by-frame capture
                  for ( let frame = 0; frame < totalFrames; frame++ ) {
                    const progress = calculateProgress(
                      frame,
                      totalFrames
                    );

                    timeline.progress( progress );
                    progressValues.push( timeline.progress() );
                  }

                  // Verify monotonicity: each progress value should be >= the previous
                  for ( let i = 1; i < progressValues.length; i++ ) {
                    expect( progressValues[ i ] ).toBeGreaterThanOrEqual( progressValues[ i - 1 ] );
                  }

                  // Verify progress starts at 0
                  expect( progressValues[ 0 ] ).toBe( 0 );

                  // Verify progress ends at or very close to 1
                  expect( progressValues[ progressValues.length - 1 ] ).toBeGreaterThanOrEqual( 0.99 );
                  expect( progressValues[ progressValues.length - 1 ] ).toBeLessThanOrEqual( 1 );

                  // Clean up
                  timeline.kill();
                }
              ),
              {
                numRuns: 100,
              }
            );
          }
        );

        it(
          "should maintain monotonicity with frame synchronization events",
          () => {
            fc.assert(
              fc.property(
                fc.record( {
                  duration: fc.float( {
                    min: 1,
                    max: 10,
                    noNaN: true,
                  } ),
                  framerate: fc.constantFrom(
                    24,
                    30,
                    60
                  ),
                } ),
                ( animationOptions ) => {
                  // Create a timeline
                  const timeline = gsap.timeline( {
                    paused: true,
                  } );

                  timeline.duration( animationOptions.duration );

                  const totalFrames = calculateTotalFrames( animationOptions );
                  const progressValues: number[] = [
                  ];

                  // Set up frame sync (simulating capture mode)
                  const cleanup = setupFrameSync(
                    timeline,
                    animationOptions,
                    (
                      frame, progress
                    ) => {
                      progressValues.push( progress );
                    }
                  );

                  // Dispatch frame seek events in sequence
                  for ( let frame = 0; frame < totalFrames; frame++ ) {
                    dispatchSeekFrame( frame );
                  }

                  // Verify monotonicity
                  for ( let i = 1; i < progressValues.length; i++ ) {
                    expect( progressValues[ i ] ).toBeGreaterThanOrEqual( progressValues[ i - 1 ] );
                  }

                  // Clean up
                  cleanup();
                  timeline.kill();
                }
              ),
              {
                numRuns: 100,
              }
            );
          }
        );

        it(
          "should handle edge case of single frame animation",
          () => {
            fc.assert(
              fc.property(
                fc.record( {
                  duration: fc.float( {
                    min: 0.01,
                    max: 0.1,
                    noNaN: true,
                  } ),
                  framerate: fc.constantFrom(
                    24,
                    30
                  ),
                } ),
                ( animationOptions ) => {
                  const timeline = gsap.timeline( {
                    paused: true,
                  } );

                  timeline.duration( animationOptions.duration );

                  const totalFrames = calculateTotalFrames( animationOptions );

                  // Even with very short durations, we should have at least 1 frame
                  expect( totalFrames ).toBeGreaterThanOrEqual( 1 );

                  const progressValues: number[] = [
                  ];

                  for ( let frame = 0; frame < totalFrames; frame++ ) {
                    const progress = calculateProgress(
                      frame,
                      totalFrames
                    );

                    timeline.progress( progress );
                    progressValues.push( timeline.progress() );
                  }

                  // Verify monotonicity even for single or few frames
                  for ( let i = 1; i < progressValues.length; i++ ) {
                    expect( progressValues[ i ] ).toBeGreaterThanOrEqual( progressValues[ i - 1 ] );
                  }

                  timeline.kill();
                }
              ),
              {
                numRuns: 100,
              }
            );
          }
        );
      }
    );
  }
);
