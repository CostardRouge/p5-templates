/**
 * The Vector 3D element's five views, as display lists. The p5 widget and the
 * inspector's tiles paint the same list, so what is worth pinning here is the
 * geometry both rely on: the domain mapping, where the point lands in each
 * view, what the label / readout add, and that the schema's view list and the
 * builder's never drift apart.
 */

import {
  HUD_VECTOR3D_VIEWS, HudVector3dItemSchema
} from "@/types/sketch.types";
import {
  VECTOR3D_VIEW_IDS,
  buildVector3dView,
  defaultVector3dView,
  toTriple,
  vector3dCoordinatesText,
  vector3dCube,
  vector3dFractions
} from "../vector3dViews.js";

type Op = {
  op: string;
  [ key: string ]: unknown;
};

const domain = {
  xMin: -1,
  xMax: 1,
  yMin: -0.5,
  yMax: 0.5,
  zMin: -1,
  zMax: 1
};

const cfg = {
  kind: "position",
  domain,
  yDown: true,
  coordinates: "relative",
  decimals: 2
};

function build(
  view: string, overrides: Record<string, unknown> = {}
) {
  return buildVector3dView( {
    view,
    value: {
      x: 0.5,
      y: 0.25,
      z: -0.5
    },
    cfg,
    size: 10,
    label: "POSITION",
    ...overrides
  } ) as { w: number;
    h: number;
    ops: Op[] };
}

const texts = ( ops: Op[] ) => ops.filter( ( op ) => op.op === "text" ).map( ( op ) => op.text );
const discs = ( ops: Op[] ) => ops.filter( ( op ) => op.op === "disc" );

describe(
  "vector3dViews",
  () => {
    it(
      "lists the same views as the schema, box first",
      () => {
        expect( VECTOR3D_VIEW_IDS ).toEqual( [
          ...HUD_VECTOR3D_VIEWS
        ] );
        expect( HudVector3dItemSchema.parse( {
          type: "hud-vector3d"
        } ).view ).toBe( "box" );
      }
    );

    it(
      "opens a direction as the gizmo and anything else as the box",
      () => {
        expect( defaultVector3dView( "direction" ) ).toBe( "gizmo" );
        expect( defaultVector3dView( "position" ) ).toBe( "box" );
        expect( defaultVector3dView( undefined ) ).toBe( "box" );
      }
    );

    it(
      "reads a triple from an object or an array, and nothing from a 2D point",
      () => {
        expect( toTriple( {
          x: 1,
          y: 2,
          z: 3
        } ) ).toEqual( {
          x: 1,
          y: 2,
          z: 3
        } );
        expect( toTriple( [
          1,
          2,
          3
        ] ) ).toEqual( {
          x: 1,
          y: 2,
          z: 3
        } );
        expect( toTriple( {
          x: 1,
          y: 2
        } ) ).toBeNull();
        expect( toTriple( "1,2,3" ) ).toBeNull();
      }
    );

    it(
      "maps each axis over its own domain, and mirrors y for a y-down canvas",
      () => {
        const value = {
          x: 0.5,
          y: 0.25,
          z: -0.5
        };

        expect( vector3dFractions(
          value,
          domain
        ) ).toEqual( {
          x: 0.75,
          // 0.25 in [-0.5, 0.5], not in [-1, 1]: the narrower axis is honoured.
          y: 0.75,
          z: 0.25
        } );

        const up = vector3dCube(
          value,
          domain,
          false
        );
        const down = vector3dCube(
          value,
          domain,
          true
        );

        expect( up.y ).toBeCloseTo( 0.5 );
        expect( down.y ).toBeCloseTo( -0.5 );
        expect( down.x ).toBeCloseTo( up.x );
      }
    );

    it(
      "never prints a negative zero",
      () => {
        expect( vector3dCoordinatesText(
          {
            x: -0.001,
            y: 0.5,
            z: -1
          },
          {
            decimals: 2
          }
        ) ).toBe( "0.00, 0.50, -1.00" );
        expect( vector3dCoordinatesText(
          {
            x: 0,
            y: 0,
            z: 0
          },
          {
            coordinates: "none"
          }
        ) ).toBeNull();
      }
    );

    it.each( VECTOR3D_VIEW_IDS )(
      "builds %s as finite ops inside its own block",
      ( view ) => {
        const {
          w, h, ops
        } = build( view );

        expect( w ).toBeGreaterThan( 0 );
        expect( h ).toBeGreaterThan( 0 );
        expect( ops.length ).toBeGreaterThan( 0 );

        for ( const op of ops ) {
          for ( const [
            key,
            value
          ] of Object.entries( op ) ) {
            if ( typeof value === "number" ) {
              expect( {
                view,
                op: op.op,
                key,
                finite: Number.isFinite( value )
              } ).toMatchObject( {
                finite: true
              } );
            }
          }
        }

        // The point is drawn, and it is inside the block.
        for ( const disc of discs( ops ) ) {
          expect( disc.x as number ).toBeGreaterThanOrEqual( -1 );
          expect( disc.x as number ).toBeLessThanOrEqual( w + 1 );
          expect( disc.y as number ).toBeGreaterThanOrEqual( -1 );
          expect( disc.y as number ).toBeLessThanOrEqual( h + 1 );
        }
      }
    );

    it(
      "prints the label above and the triple below, and a bare build prints neither",
      () => {
        const labelled = build( "box" );

        expect( texts( labelled.ops ) ).toEqual( expect.arrayContaining( [
          "POSITION",
          "0.50, 0.25, -0.50"
        ] ) );

        const bare = build(
          "box",
          {
            bare: true
          }
        );

        expect( texts( bare.ops ) ).not.toContain( "POSITION" );
        expect( texts( bare.ops ) ).not.toContain( "0.50, 0.25, -0.50" );
        expect( bare.h ).toBeLessThan( labelled.h );
      }
    );

    it(
      "prints the bars' values on their rows instead of a readout line",
      () => {
        const bars = texts( build( "bars" ).ops );

        expect( bars ).not.toContain( "0.50, 0.25, -0.50" );
        expect( bars ).toEqual( expect.arrayContaining( [
          " 0.50",
          " 0.25",
          "-0.50"
        ] ) );

        const silent = texts( build(
          "bars",
          {
            cfg: {
              ...cfg,
              coordinates: "none"
            }
          }
        ).ops );

        expect( silent ).toEqual( [
          "X",
          "Y",
          "Z",
          "POSITION"
        ] );
      }
    );

    it(
      "places the point of the three-planes XY map at the value's fractions",
      () => {
        const {
          ops
        } = build(
          "planes",
          {
            label: ""
          }
        );
        // Map size is 3.4 × size; the first disc is the XY map's point.
        const map = 34;
        const [
          xy
        ] = discs( ops );

        expect( xy.x ).toBeCloseTo( 0.75 * map );
        // yDown: a larger y sits lower on the map, as on the canvas.
        expect( xy.y ).toBeCloseTo( 0.75 * map );
      }
    );

    it(
      "draws a direction as an arrow, a position as a stem and a shadow",
      () => {
        const position = build( "box" ).ops;
        const direction = build(
          "box",
          {
            cfg: {
              ...cfg,
              kind: "direction"
            }
          }
        ).ops;

        expect( position.some( ( op ) => op.op === "ellipse" ) ).toBe( true );
        expect( position.some( ( op ) => op.op === "tri" ) ).toBe( false );
        expect( direction.some( ( op ) => op.op === "tri" ) ).toBe( true );
        expect( direction.some( ( op ) => op.op === "ellipse" ) ).toBe( false );
      }
    );

    it(
      "fades the trail from old to new",
      () => {
        const trail = [
          0,
          1,
          2,
          3
        ].map( ( i ) => ( {
          x: -0.5 + i * 0.2,
          y: 0,
          z: 0
        } ) );
        const plain = build( "box" ).ops.length;
        const trailed = build(
          "box",
          {
            trail
          }
        ).ops;

        // Three segments between four points.
        expect( trailed.length - plain ).toBe( 3 );
      }
    );
  }
);
