/**
 * @jest-environment jsdom
 */
/**
 * What the export panel says while a run is in flight — and, more to the point,
 * how wide it says it.
 *
 * The defect this replaces was not wrong information, it was moving
 * information: the runner formatted `38% (172/450)` itself, that string changed
 * width on every captured frame, and it landed in an auto-layout table which
 * re-measured all six columns to fit it. The row visibly crawled sideways for
 * the length of an export.
 *
 * So the rule under test is a layout one: every label a running variant can
 * show is the same width as the others it can show at that moment, and the
 * frame counter is padded to its total's width.
 */

import {
  render, screen
} from "@testing-library/react";
import React from "react";

import PhaseMeter, {
  formatFrames, statusLabel
} from "../ExportProgress";
import type {
  ExportItemState
} from "@/lib/export/runExportBatch";

function state( over: Partial<ExportItemState> = {} ): ExportItemState {
  return {
    variantId: "v1",
    status: "running",
    percentage: 0,
    phase: "capturing",
    phaseProgress: 0,
    ...over
  };
}

describe(
  "formatFrames",
  () => {
    it(
      "pads the counter so its width never changes during a run",
      () => {
        const widths = [
          1,
          7,
          72,
          450
        ].map( ( frame ) => formatFrames(
          frame,
          450
        ).length );

        expect( new Set( widths ).size ).toBe( 1 );
      }
    );

    it(
      "pads with a figure space, which HTML does not collapse",
      () => {
        // An ASCII space would be collapsed away by the renderer and the
        // padding would do nothing at all.
        expect( formatFrames(
          7,
          450
        ) ).toBe( "  7/450" );
      }
    );
  }
);

describe(
  "statusLabel",
  () => {
    it(
      "counts frames while capturing, and names the phase otherwise",
      () => {
        expect( statusLabel(
          state( {
            frame: 172,
            totalFrames: 450
          } ),
          false
        ) ).toBe( "172/450" );

        expect( statusLabel(
          state( {
            phase: "encoding",
            phaseProgress: null
          } ),
          false
        ) ).toBe( "Encoding…" );
      }
    );

    it(
      "says whether a finished variant actually reached the user",
      () => {
        const done = state( {
          status: "done",
          bytes: 1_200_000
        } );

        expect( statusLabel(
          done,
          true
        ) ).toMatch( /^✓/ );
        expect( statusLabel(
          done,
          false
        ) ).toMatch( /^·/ );
      }
    );
  }
);

describe(
  "PhaseMeter",
  () => {
    it(
      "draws one segment per phase the output really has",
      () => {
        const {
          container, rerender
        } = render( <PhaseMeter kind="video" state={ state() } /> );

        expect( container.querySelectorAll( ".rounded-full" ) ).toHaveLength( 4 );

        rerender( <PhaseMeter kind="image" state={ state() } /> );

        expect( container.querySelectorAll( ".rounded-full" ) ).toHaveLength( 3 );
      }
    );

    it(
      "sweeps the phase that reports no number instead of faking one",
      () => {
        const {
          container
        } = render( <PhaseMeter
          kind="video"
          state={ state( {
            phase: "encoding",
            phaseProgress: null
          } ) }
        /> );

        expect( container.querySelector( ".animate-phase-sweep" ) ).not.toBeNull();
      }
    );

    it(
      "is decorative: the label beside it carries the meaning",
      () => {
        render( <div>
          <PhaseMeter kind="video" state={ state() } />
        </div> );

        expect( screen.queryByRole( "progressbar" ) ).toBeNull();
      }
    );
  }
);
