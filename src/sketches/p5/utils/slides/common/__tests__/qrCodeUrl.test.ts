/**
 * Covers the QR code URL resolution rules:
 *   - origin priority: domain override -> NEXT_PUBLIC_SITE_URL -> live origin
 *   - bare hosts default to https; an explicit scheme wins
 *   - the path comes from the live page, minus the headless-capture params
 *   - the displayed caption drops the scheme
 */

import {
  buildQrUrl, normaliseBase, stripScheme
} from "../qrCodeUrl.js";

describe(
  "normaliseBase",
  () => {
    it(
      "assumes https for a bare host",
      () => {
        expect( normaliseBase( "mysite.com" ) ).toBe( "https://mysite.com" );
      }
    );

    it(
      "keeps an explicit scheme (including http)",
      () => {
        expect( normaliseBase( "http://localhost:3000" ) ).toBe( "http://localhost:3000" );
        expect( normaliseBase( "https://x.dev" ) ).toBe( "https://x.dev" );
      }
    );

    it(
      "trims whitespace and trailing slashes, and maps empty to ''",
      () => {
        expect( normaliseBase( "  mysite.com/  " ) ).toBe( "https://mysite.com" );
        expect( normaliseBase( "" ) ).toBe( "" );
        expect( normaliseBase( undefined ) ).toBe( "" );
      }
    );
  }
);

describe(
  "stripScheme",
  () => {
    it(
      "removes http(s):// for display",
      () => {
        expect( stripScheme( "https://p5.example.com/a/b" ) ).toBe( "p5.example.com/a/b" );
        expect( stripScheme( "http://localhost:3000/x" ) ).toBe( "localhost:3000/x" );
      }
    );

    it(
      "leaves scheme-less strings untouched",
      () => {
        expect( stripScheme( "example.com/x" ) ).toBe( "example.com/x" );
        expect( stripScheme( "" ) ).toBe( "" );
      }
    );
  }
);

describe(
  "buildQrUrl",
  () => {
    const href = "http://localhost:3000/sketches/p5/photo/photo-3d-sphere?id=abc&capturing=&previewFramerate=20&previewDuration=3#frag";

    it(
      "uses the domain override (bare host -> https) with the live path",
      () => {
        expect( buildQrUrl( {
          domainOverride: "p5.costardrouge.com",
          siteUrl: "https://ignored.example",
          href
        } ) ).toBe( "https://p5.costardrouge.com/sketches/p5/photo/photo-3d-sphere?id=abc#frag" );
      }
    );

    it(
      "honours an explicit scheme in the override",
      () => {
        expect( buildQrUrl( {
          domainOverride: "http://192.168.1.10:3000",
          href
        } ) ).toBe( "http://192.168.1.10:3000/sketches/p5/photo/photo-3d-sphere?id=abc#frag" );
      }
    );

    it(
      "falls back to NEXT_PUBLIC_SITE_URL when no override is set",
      () => {
        expect( buildQrUrl( {
          siteUrl: "https://p5.costardrouge.com",
          href
        } ) ).toBe( "https://p5.costardrouge.com/sketches/p5/photo/photo-3d-sphere?id=abc#frag" );
      }
    );

    it(
      "falls back to the live origin when no override and no site URL",
      () => {
        expect( buildQrUrl( {
          href
        } ) ).toBe( "http://localhost:3000/sketches/p5/photo/photo-3d-sphere?id=abc#frag" );
      }
    );

    it(
      "strips only the capture params and keeps other query params",
      () => {
        const result = buildQrUrl( {
          siteUrl: "https://x.dev",
          href
        } );

        expect( result ).toContain( "?id=abc" );
        expect( result ).not.toContain( "capturing" );
        expect( result ).not.toContain( "previewFramerate" );
        expect( result ).not.toContain( "previewDuration" );
      }
    );

    it(
      "returns '' when no origin can be determined",
      () => {
        expect( buildQrUrl( {} ) ).toBe( "" );
        expect( buildQrUrl( {
          href: "not a url"
        } ) ).toBe( "" );
      }
    );

    it(
      "uses the override origin even when the page has no path",
      () => {
        expect( buildQrUrl( {
          domainOverride: "mysite.com",
          href: "https://localhost/"
        } ) ).toBe( "https://mysite.com/" );
      }
    );
  }
);
