import {
  localSameOrigin, parseFavoriteChanges, sketchKeyOfHref
} from "../changes";

describe(
  "favourite changes",
  () => {
    it(
      "reads a batch of stars by sketch key",
      () => {
        expect( [
          ...parseFavoriteChanges( {
            changes: {
              "p5/materials-v1-flame": true,
              "threejs/dragon-corridor": false
            }
          } )
        ] ).toEqual( [
          [
            "p5/materials-v1-flame",
            true
          ],
          [
            "threejs/dragon-corridor",
            false
          ]
        ] );
      }
    );

    it(
      "refuses anything that is not a sketch key and a boolean",
      () => {
        for ( const changes of [
          null,
          [],
          {},
          {
            "../../etc/passwd": true
          },
          {
            "p5/materials/materials-v1-flame": true
          },
          {
            "ruby/x": true
          },
          {
            "p5/UPPER": true
          },
          {
            "p5/ok": "yes"
          }
        ] ) {
          expect( () => parseFavoriteChanges( {
            changes
          } ) ).toThrow();
        }
        expect( () => parseFavoriteChanges( null ) ).toThrow();
      }
    );

    it(
      "keys a card by its link",
      () => {
        expect( sketchKeyOfHref( "/sketches/p5/materials/materials-v1-flame" ) ).toBe( "p5/materials-v1-flame" );
        expect( sketchKeyOfHref( "/sketches/p5/neon-graffiti" ) ).toBe( "p5/neon-graffiti" );
        expect( sketchKeyOfHref( "/gallery" ) ).toBeNull();
        expect( sketchKeyOfHref( "/sketches/p5" ) ).toBeNull();
      }
    );

    it(
      "takes a write only from this machine and this site",
      () => {
        expect( localSameOrigin(
          "localhost:3000",
          "http://localhost:3000"
        ) ).toBe( true );
        expect( localSameOrigin(
          "127.0.0.1:3000",
          null
        ) ).toBe( true );
        expect( localSameOrigin(
          "localhost:3000",
          "https://evil.example"
        ) ).toBe( false );
        expect( localSameOrigin(
          "192.168.1.20:3000",
          "http://192.168.1.20:3000"
        ) ).toBe( false );
        expect( localSameOrigin(
          null,
          null
        ) ).toBe( false );
      }
    );
  }
);
