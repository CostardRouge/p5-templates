/**
 * favorites.set: the star, written through the development server only.
 */
import {
  createCommandRegistry
} from "../../../../scripts/mcp/registry.ts";
import {
  favoriteCommands
} from "../commands/favoriteCommands";
import {
  fakeHandles
} from "./fakeHandles";

describe(
  "favourite commands",
  () => {
    const realFetch = globalThis.fetch;

    afterEach( () => {
      globalThis.fetch = realFetch;
    } );

    it(
      "send the stars as one batch keyed by engine and name, and refuse an unknown sketch",
      async() => {
        const fake = fakeHandles( {} );
        const registry = createCommandRegistry();
        const sent: unknown[] = [];

        globalThis.fetch = ( async(
          _url: unknown, init?: { body?: unknown }
        ) => {
          sent.push( JSON.parse( String( init?.body ) ) );

          return new Response(
            JSON.stringify( {
              written: 1
            } ),
            {
              status: 200
            }
          );
        } ) as typeof fetch;
        registry.register( favoriteCommands( fake.handles ) );

        await expect( registry.execute(
          "favorites.set",
          {
            sketches: [
              "p5/nope/nope"
            ]
          }
        ) ).rejects.toThrow( /no sketch/ );
        expect( sent ).toEqual( [] );
        expect( await registry.execute(
          "favorites.set",
          {
            sketches: [
              "p5/voronoi/voronoi-v1-cells"
            ]
          }
        ) ).toMatchObject( {
          written: 1,
          on: true
        } );
        expect( sent ).toEqual( [
          {
            changes: {
              "p5/voronoi-v1-cells": true
            }
          }
        ] );
      }
    );

    it(
      "say why when the server refuses",
      async() => {
        const fake = fakeHandles( {} );
        const registry = createCommandRegistry();

        globalThis.fetch = ( async() => new Response(
          JSON.stringify( {
            error: "the favourites editor only writes from this machine"
          } ),
          {
            status: 403
          }
        ) ) as typeof fetch;
        registry.register( favoriteCommands( fake.handles ) );

        await expect( registry.execute(
          "favorites.set",
          {
            sketches: [
              "p5/voronoi/voronoi-v1-cells"
            ],
            on: false
          }
        ) ).rejects.toThrow( /only writes from this machine/ );
      }
    );
  }
);
