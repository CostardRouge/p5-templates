/**
 * @jest-environment jsdom
 */
import React from "react";
import {
  render, screen
} from "@testing-library/react";

import SketchBreadcrumb from "../SketchBreadcrumb";

// Jest compiles JSX with the classic runtime (`jsx: "react"`), and this
// component relies on Next's automatic runtime, so it has no React in scope.
( globalThis as unknown as { React: typeof React } ).React = React;

describe(
  "SketchBreadcrumb",
  () => {
    // On a phone the breadcrumb is the sketch page's only way back to the
    // library. A new tab starts with no history, so the browser's Back closed
    // it instead of returning to the list or the home page.
    it(
      "navigates in the same tab",
      () => {
        render( <SketchBreadcrumb
          engineId="p5"
          name="iridescent-v7-peaks-shell"
          category="iridescent"
        /> );

        const links = screen.getAllByRole( "link" );

        expect( links.map( ( link ) => link.getAttribute( "href" ) ) ).toEqual( [
          "/sketches/p5",
          "/sketches/p5?category=iridescent",
          "/sketches/p5/iridescent/iridescent-v7-peaks-shell"
        ] );

        for ( const link of links ) {
          expect( link.hasAttribute( "target" ) ).toBe( false );
        }
      }
    );
  }
);
