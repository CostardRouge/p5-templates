import {
  filterCatalog, resolveSketch, sketchId, type CatalogEntry
} from "../catalog.ts";
import {
  embedUrl, frameIndexFor
} from "../frameRenderer.ts";

const ENTRIES: CatalogEntry[] = [
  {
    name: "voronoi-v1-cells",
    engine: "p5",
    category: "voronoi",
    hasSketchForm: true
  },
  {
    name: "voronoi-v2-flow",
    engine: "p5",
    category: "voronoi"
  },
  {
    name: "twin",
    engine: "p5",
    category: "a"
  },
  {
    name: "twin",
    engine: "gsap",
    category: "b"
  },
  {
    name: "study",
    engine: "p5",
    category: "voronoi",
    hiddenFromGallery: true
  },
  {
    name: "loose",
    engine: "threejs",
    category: null
  }
];

describe(
  "the catalogue",
  () => {
    it(
      "names a sketch by its route tail",
      () => {
        expect( sketchId( ENTRIES[ 0 ] ) ).toBe( "p5/voronoi/voronoi-v1-cells" );
        expect( sketchId( ENTRIES[ 5 ] ) ).toBe( "threejs/loose" );
      }
    );

    it(
      "filters, hides studies unless asked, and sorts by id",
      () => {
        expect( filterCatalog(
          ENTRIES,
          {
            category: "voronoi"
          }
        ).map( sketchId ) ).toEqual( [
          "p5/voronoi/voronoi-v1-cells",
          "p5/voronoi/voronoi-v2-flow"
        ] );
        expect( filterCatalog(
          ENTRIES,
          {
            category: "voronoi",
            includeHidden: true
          }
        ) ).toHaveLength( 3 );
        expect( filterCatalog(
          ENTRIES,
          {
            engine: "gsap"
          }
        ).map( sketchId ) ).toEqual( [
          "gsap/b/twin"
        ] );
        expect( filterCatalog(
          ENTRIES,
          {
            query: "FLOW"
          }
        ).map( sketchId ) ).toEqual( [
          "p5/voronoi/voronoi-v2-flow"
        ] );
      }
    );

    it(
      "resolves an id, a route path or a unique bare name",
      () => {
        expect( resolveSketch(
          ENTRIES,
          "p5/voronoi/voronoi-v1-cells"
        ) ).toBe( ENTRIES[ 0 ] );
        expect( resolveSketch(
          ENTRIES,
          "/sketches/p5/voronoi/voronoi-v1-cells"
        ) ).toBe( ENTRIES[ 0 ] );
        expect( resolveSketch(
          ENTRIES,
          "voronoi-v2-flow"
        ) ).toBe( ENTRIES[ 1 ] );
      }
    );

    it(
      "refuses an ambiguous or unknown name, saying what it could be",
      () => {
        expect( () => resolveSketch(
          ENTRIES,
          "twin"
        ) ).toThrow( "\"twin\" names 2 sketches — say which: p5/a/twin, gsap/b/twin" );
        expect( () => resolveSketch(
          ENTRIES,
          "voronoi-v9"
        ) ).toThrow( "no sketch \"voronoi-v9\" — near: p5/voronoi/voronoi-v1-cells, p5/voronoi/voronoi-v2-flow" );
      }
    );
  }
);

describe(
  "placing a frame",
  () => {
    const timing = {
      frameRate: 60,
      duration: 12,
      totalFrames: 720
    };

    it(
      "turns a time or a loop position into the recorder's frame index",
      () => {
        expect( frameIndexFor(
          {},
          timing
        ) ).toBe( 0 );
        expect( frameIndexFor(
          {
            time: 3
          },
          timing
        ) ).toBe( 180 );
        expect( frameIndexFor(
          {
            progress: 0.5
          },
          timing
        ) ).toBe( 360 );
        expect( frameIndexFor(
          {
            frame: 42
          },
          timing
        ) ).toBe( 42 );
      }
    );

    it(
      "refuses past the loop, two placements at once, or a time with no clock",
      () => {
        expect( () => frameIndexFor(
          {
            time: 20
          },
          timing
        ) ).toThrow( "frame 1200 is past the end — the loop is 720 frames (12 s at 60 fps)" );
        expect( () => frameIndexFor(
          {
            time: 1,
            frame: 2
          },
          timing
        ) ).toThrow( "give one of frame, time, progress — got frame and time" );
        expect( () => frameIndexFor(
          {
            time: 1
          },
          null
        ) ).toThrow( /pass `frame` instead/ );
        expect( frameIndexFor(
          {
            frame: 5000
          },
          null
        ) ).toBe( 5000 );
      }
    );

    it(
      "speaks the /embed fragment contract",
      () => {
        expect( embedUrl(
          "http://x/",
          "p5/voronoi/voronoi-v1-cells",
          {
            a: 1
          },
          {
            width: 540,
            height: 675
          }
        ) ).toBe( "http://x/embed/p5/voronoi/voronoi-v1-cells#o=eyJhIjoxfQ&s=540x675" );
        expect( embedUrl(
          "http://x",
          "p5/a/b",
          {}
        ) ).toBe( "http://x/embed/p5/a/b#o=e30" );
      }
    );
  }
);
