/**
 * @jest-environment jsdom
 */

import React from "react";
import {
  act, fireEvent, render, screen
} from "@testing-library/react";

import ImportSuccessBanner from "../ImportSuccessBanner";

describe(
  "ImportSuccessBanner",
  () => {
    beforeEach( () => {
      jest.useFakeTimers();
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    it(
      "announces a success politely and dismisses itself",
      () => {
        const onDismiss = jest.fn();

        render( <ImportSuccessBanner
          message="Options imported successfully"
          onDismiss={ onDismiss }
        /> );

        expect( screen.getByRole( "status" ).textContent ).toContain( "Options imported successfully" );

        act( () => {
          jest.advanceTimersByTime( 3400 );
        } );

        expect( onDismiss ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "keeps a refused import on screen as an alert until the user dismisses it",
      () => {
        const onDismiss = jest.fn();

        render( <ImportSuccessBanner
          tone="error"
          message="Import refused, nothing was changed — content.0: Invalid input"
          onDismiss={ onDismiss }
        /> );

        expect( screen.getByRole( "alert" ).textContent ).toContain( "content.0" );

        act( () => {
          jest.advanceTimersByTime( 60_000 );
        } );

        expect( onDismiss ).not.toHaveBeenCalled();

        fireEvent.click( screen.getByRole(
          "button",
          {
            name: "Dismiss"
          }
        ) );

        expect( onDismiss ).toHaveBeenCalledTimes( 1 );
      }
    );
  }
);
