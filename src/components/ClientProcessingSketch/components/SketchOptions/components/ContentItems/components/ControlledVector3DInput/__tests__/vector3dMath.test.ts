import {
  DEFAULT_VIEW,
  UNIT_AXES,
  applyMat3,
  axisDragAmount,
  completeVector,
  fromCube,
  length3,
  projectPoint,
  randomVector3D,
  resolveAxes3D,
  snapToAxis,
  snapVector,
  toCube,
  transposeMat3,
  unprojectScreenDelta,
  viewDepthAxis,
  viewMatrix,
  type Vector3DValue
} from "../utils/vector3dMath";

const signed = {
  min: -1,
  max: 1,
  step: 0.01
};

const close = (
  a: Vector3DValue, b: Vector3DValue, digits = 9
) => {
  expect( a.x ).toBeCloseTo(
    b.x,
    digits
  );
  expect( a.y ).toBeCloseTo(
    b.y,
    digits
  );
  expect( a.z ).toBeCloseTo(
    b.z,
    digits
  );
};

describe(
  "resolveAxes3D",
  () => {
    it(
      "spans [-1, 1] on all three axes by default",
      () => {
        expect( resolveAxes3D( {} ) ).toEqual( {
          xAxis: signed,
          yAxis: signed,
          zAxis: signed
        } );
      }
    );

    it(
      "starts at 0 when negatives are not allowed, and layers per-axis overrides",
      () => {
        expect( resolveAxes3D( {
          allowNegative: false,
          max: 10,
          step: 1,
          zAxis: {
            min: -1,
            max: 4
          }
        } ) ).toEqual( {
          xAxis: {
            min: 0,
            max: 10,
            step: 1
          },
          yAxis: {
            min: 0,
            max: 10,
            step: 1
          },
          zAxis: {
            min: -1,
            max: 4,
            step: 1
          }
        } );
      }
    );
  }
);

describe(
  "snapToAxis / snapVector / completeVector",
  () => {
    it(
      "snaps to the step from min and clamps into the range",
      () => {
        expect( snapToAxis(
          0.314,
          signed
        ) ).toBe( 0.31 );
        expect( snapToAxis(
          7,
          signed
        ) ).toBe( 1 );
        expect( snapToAxis(
          2.4,
          {
            min: -1,
            max: 4,
            step: 0.5
          }
        ) ).toBe( 2.5 );
      }
    );

    it(
      "snaps every component against its own axis",
      () => {
        expect( snapVector(
          {
            x: 0.126,
            y: 9,
            z: -3
          },
          resolveAxes3D( {
            zAxis: {
              min: -5
            }
          } )
        ) ).toEqual( {
          x: 0.13,
          y: 1,
          z: -3
        } );
      }
    );

    it(
      "fills a missing component with the axis minimum",
      () => {
        expect( completeVector(
          {
            x: 0.5
          },
          resolveAxes3D( {} )
        ) ).toEqual( {
          x: 0.5,
          y: -1,
          z: -1
        } );
      }
    );
  }
);

describe(
  "randomVector3D",
  () => {
    const drawsOf = ( ...fractions: number[] ) => {
      let index = 0;

      return () => fractions[ index++ ] ?? 0;
    };

    it(
      "maps three draws to x, y then z, snapped per axis",
      () => {
        expect( randomVector3D(
          {
            zAxis: {
              min: 0,
              max: 10,
              step: 1
            }
          },
          drawsOf(
            0.314,
            0.777,
            0.62
          )
        ) ).toEqual( {
          x: -0.37,
          y: 0.55,
          z: 6
        } );
      }
    );
  }
);

describe(
  "cube space",
  () => {
    const axes = resolveAxes3D( {
      xAxis: {
        min: -0.8,
        max: 0.8
      },
      zAxis: {
        min: -1,
        max: 4
      }
    } );

    it(
      "maps each axis' range onto [-1, 1] independently",
      () => {
        close(
          toCube(
            {
              x: 0.8,
              y: 0,
              z: 1.5
            },
            axes
          ),
          {
            x: 1,
            y: 0,
            z: 0
          }
        );
      }
    );

    it(
      "round-trips through fromCube with snapping",
      () => {
        const v = {
          x: -0.4,
          y: 0.25,
          z: 2.5
        };

        expect( fromCube(
          toCube(
            v,
            axes
          ),
          axes
        ) ).toEqual( v );
      }
    );

    it(
      "mirrors y when yDown is set, both ways",
      () => {
        const v = {
          x: 0,
          y: 1,
          z: 0
        };
        const cube = toCube(
          v,
          axes,
          true
        );

        expect( cube.y ).toBe( -1 );
        expect( fromCube(
          cube,
          axes,
          true
        ) ).toEqual( v );
      }
    );
  }
);

describe(
  "the box's camera",
  () => {
    it(
      "viewMatrix is a rotation (its transpose inverts it)",
      () => {
        const m = viewMatrix( DEFAULT_VIEW );
        const v = {
          x: 0.3,
          y: -0.7,
          z: 0.5
        };

        close(
          applyMat3(
            transposeMat3( m ),
            applyMat3(
              m,
              v
            )
          ),
          v
        );
        expect( length3( applyMat3(
          m,
          v
        ) ) ).toBeCloseTo( length3( v ) );
      }
    );

    it(
      "is the identity at yaw 0 / pitch 0 (+x right, +y up, +z toward the viewer)",
      () => {
        const view = {
          yaw: 0,
          pitch: 0
        };

        close(
          projectPoint(
            UNIT_AXES.x,
            view
          ),
          UNIT_AXES.x
        );
        close(
          projectPoint(
            UNIT_AXES.y,
            view
          ),
          UNIT_AXES.y
        );
        close(
          projectPoint(
            UNIT_AXES.z,
            view
          ),
          UNIT_AXES.z
        );
      }
    );

    it(
      "lays the default three-quarter view out as expected",
      () => {
        const px = projectPoint(
          UNIT_AXES.x,
          DEFAULT_VIEW
        );
        const pz = projectPoint(
          UNIT_AXES.z,
          DEFAULT_VIEW
        );
        const py = projectPoint(
          UNIT_AXES.y,
          DEFAULT_VIEW
        );

        // +x goes right and comes toward the viewer (so it sits lower on screen).
        expect( px.x ).toBeGreaterThan( 0 );
        expect( px.z ).toBeGreaterThan( 0 );
        expect( px.y ).toBeLessThan( 0 );
        // +z goes left and toward the viewer.
        expect( pz.x ).toBeLessThan( 0 );
        expect( pz.z ).toBeGreaterThan( 0 );
        // +y stays up, foreshortened, and tilts toward the raised camera.
        expect( py.y ).toBeGreaterThan( 0.8 );
        expect( py.z ).toBeGreaterThan( 0 );
      }
    );

    it(
      "a screen-plane drag never moves along the depth axis",
      () => {
        const delta = unprojectScreenDelta(
          0.3,
          -0.2,
          DEFAULT_VIEW
        );
        const depth = viewDepthAxis( DEFAULT_VIEW );

        expect( Math.abs( delta.x * depth.x + delta.y * depth.y + delta.z * depth.z ) ).toBeLessThan( 1e-9 );
        expect( projectPoint(
          delta,
          DEFAULT_VIEW
        ).z ).toBeCloseTo( 0 );
      }
    );

    it(
      "axisDragAmount reads a drag along the projected axis, and refuses an end-on axis",
      () => {
        const projectedX = projectPoint(
          UNIT_AXES.x,
          DEFAULT_VIEW
        );

        // Dragging exactly along +x's projection by twice its length = +2 along x.
        expect( axisDragAmount(
          projectedX.x * 2,
          projectedX.y * 2,
          UNIT_AXES.x,
          DEFAULT_VIEW
        ) ).toBeCloseTo( 2 );

        // Looking straight down +z, that axis projects to a point.
        expect( axisDragAmount(
          1,
          1,
          UNIT_AXES.z,
          {
            yaw: 0,
            pitch: 0
          }
        ) ).toBe( 0 );
      }
    );
  }
);
