/**
 * @jest-environment jsdom
 */
/**
 * The preview is what a phone user looks at before deciding whether to keep an
 * export, so its guarantees are about what it renders and what it releases:
 *
 *   - a still and a video get a player each, and the two are not interchangeable
 *     (a .gif in a <video> renders nothing at all),
 *   - a zip says so instead of pretending to be previewable,
 *   - the primary action is Share only where the browser says files can be
 *     shared, and Download everywhere else,
 *   - and every object URL is revoked when the preview goes away, or each
 *     export would pin its blobs for the life of the document.
 */

import React from "react";
import {
  render, screen
} from "@testing-library/react";

import ExportPreview from "../ExportPreview";
import type {
  ExportArtifact
} from "@/lib/export/runExportBatch";

function artifact(
  fileName: string, type: string
): ExportArtifact {
  return {
    fileName,
    blob: new Blob(
      [
        "x".repeat( 2048 )
      ],
      {
        type
      }
    )
  };
}

describe(
  "ExportPreview",
  () => {
    let created: string[] = [];
    let revoked: string[] = [];

    beforeEach( () => {
      created = [];
      revoked = [];

      // jsdom implements neither, and the component's whole memory story is
      // that these two calls are balanced.
      URL.createObjectURL = jest.fn( () => {
        const url = `blob:test/${ created.length }`;

        created.push( url );

        return url;
      } );
      URL.revokeObjectURL = jest.fn( ( url: string ) => {
        revoked.push( url );
      } );
    } );

    afterEach( () => {
      delete ( navigator as {
        canShare?: unknown;
      } ).canShare;
    } );

    it(
      "renders a still as an image, captioned with its name and size",
      () => {
        render( <ExportPreview
          title="Post"
          artifacts={ [
            artifact(
              "sketch-1080x1350.png",
              "image/png"
            )
          ] }
          onBack={ () => undefined }
        /> );

        const image = screen.getByAltText( "sketch-1080x1350.png" );

        expect( image.getAttribute( "src" ) ).toBe( created[ 0 ] );
        expect( screen.getByText( /sketch-1080x1350\.png · 2.0 KB/ ) ).toBeTruthy();
        expect( document.querySelector( "video" ) ).toBeNull();
      }
    );

    it(
      "renders a gif as an image rather than a video",
      () => {
        // A .gif is not a video container: a <video> would show nothing, and
        // the browser gives no error for it.
        render( <ExportPreview
          title="Loop"
          artifacts={ [
            artifact(
              "sketch.gif",
              "image/gif"
            )
          ] }
          onBack={ () => undefined }
        /> );

        expect( screen.getByAltText( "sketch.gif" ) ).toBeTruthy();
        expect( document.querySelector( "video" ) ).toBeNull();
      }
    );

    it(
      "renders a clip in a player",
      () => {
        render( <ExportPreview
          title="Reel"
          artifacts={ [
            artifact(
              "sketch.mp4",
              "video/mp4"
            )
          ] }
          onBack={ () => undefined }
        /> );

        const video = document.querySelector( "video" );

        expect( video ).not.toBeNull();
        expect( video?.getAttribute( "src" ) ).toBe( created[ 0 ] );
        expect( document.querySelector( "img" ) ).toBeNull();
      }
    );

    it(
      "says a zip cannot be previewed instead of showing an empty player",
      () => {
        render( <ExportPreview
          title="Frames"
          artifacts={ [
            artifact(
              "sketch-frames.zip",
              "application/zip"
            )
          ] }
          onBack={ () => undefined }
        /> );

        expect( screen.getByText( "No preview for this file" ) ).toBeTruthy();
        expect( document.querySelector( "img" ) ).toBeNull();
        expect( document.querySelector( "video" ) ).toBeNull();
        // The caption still identifies the file — the point of the screen is
        // knowing what you just got, not only seeing it.
        expect( screen.getByText( /sketch-frames\.zip · 2.0 KB/ ) ).toBeTruthy();
      }
    );

    it(
      "offers a download where the browser cannot share files",
      () => {
        // No `navigator.canShare` at all: every desktop browser today, and the
        // reason the download path has to stay.
        render( <ExportPreview
          title="Post"
          artifacts={ [
            artifact(
              "sketch.png",
              "image/png"
            )
          ] }
          onBack={ () => undefined }
        /> );

        expect( screen.getByRole(
          "button",
          {
            name: "Download again"
          }
        ) ).toBeTruthy();
      }
    );

    it(
      "offers the share sheet where the browser accepts these files",
      () => {
        ( navigator as {
          canShare?: unknown;
        } ).canShare = () => true;

        render( <ExportPreview
          title="Post"
          artifacts={ [
            artifact(
              "sketch.png",
              "image/png"
            )
          ] }
          onBack={ () => undefined }
        /> );

        // The wording is the whole affordance on iOS: "Share" is what leads to
        // "Save Image", which is the only route to Photos.
        expect( screen.getByRole(
          "button",
          {
            name: "Share"
          }
        ) ).toBeTruthy();
      }
    );

    it(
      "revokes every object URL when it goes away",
      () => {
        const {
          unmount
        } = render( <ExportPreview
          title="All slides"
          artifacts={ [
            artifact(
              "slide-1.png",
              "image/png"
            ),
            artifact(
              "slide-2.png",
              "image/png"
            )
          ] }
          onBack={ () => undefined }
        /> );

        expect( created ).toHaveLength( 2 );
        expect( revoked ).toHaveLength( 0 );

        unmount();

        expect( revoked ).toEqual( created );
      }
    );
  }
);
