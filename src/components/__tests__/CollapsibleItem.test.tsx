/**
 * @jest-environment jsdom
 */

import React from "react";
import {
  fireEvent, render, screen
} from "@testing-library/react";

import CollapsibleItem from "../CollapsibleItem";

/**
 * Every inspector section and parameter group is a CollapsibleItem, so its
 * header is the only way into most of a sketch's parameters. It used to be a
 * click-only <div>: no keyboard, no announced state.
 */

beforeAll( () => {
  Object.defineProperty(
    window,
    "matchMedia",
    {
      writable: true,
      value: () => ( {
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {}
      } )
    }
  );
} );

function renderSection( onAction = jest.fn() ) {
  render( <CollapsibleItem
    initialExpandedValue={ false }
    header={ ( expanded ) => (
      <div>
        <span>Canvas &amp; animation</span>
        <button
          type="button"
          onClick={ ( event ) => {
            event.stopPropagation();
            onAction();
          } }
        >
          Reset
        </button>
        <span>{expanded ? "open" : "closed"}</span>
      </div>
    ) }
  >
    <input aria-label="Width" />
  </CollapsibleItem> );

  return screen.getByRole(
    "button",
    {
      expanded: false
    }
  );
}

describe(
  "CollapsibleItem header",
  () => {
    it(
      "is a focusable button that announces its state and controls the content",
      () => {
        const header = renderSection();

        expect( header.getAttribute( "tabindex" ) ).toBe( "0" );
        expect( header.getAttribute( "aria-expanded" ) ).toBe( "false" );
        expect( document.getElementById( header.getAttribute( "aria-controls" )! ) ).not.toBeNull();
      }
    );

    it.each( [
      [
        "Enter"
      ],
      [
        " "
      ]
    ] )(
      "toggles with %j and lets the keyboard reach what it reveals",
      ( key ) => {
        const header = renderSection();

        header.focus();
        fireEvent.keyDown(
          header,
          {
            key
          }
        );

        expect( header.getAttribute( "aria-expanded" ) ).toBe( "true" );
        expect( screen.getByLabelText( "Width" ) ).toBeTruthy();

        fireEvent.keyDown(
          header,
          {
            key
          }
        );

        expect( header.getAttribute( "aria-expanded" ) ).toBe( "false" );
      }
    );

    it(
      "leaves keys pressed on a control inside the header to that control",
      () => {
        const onAction = jest.fn();
        const header = renderSection( onAction );
        const reset = screen.getByRole(
          "button",
          {
            name: "Reset"
          }
        );

        fireEvent.keyDown(
          reset,
          {
            key: "Enter"
          }
        );
        fireEvent.click( reset );

        expect( header.getAttribute( "aria-expanded" ) ).toBe( "false" );
        expect( onAction ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "still toggles on click",
      () => {
        const header = renderSection();

        fireEvent.click( header );

        expect( header.getAttribute( "aria-expanded" ) ).toBe( "true" );
      }
    );
  }
);
