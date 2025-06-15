import drawNeonLine from "./drawNeonLine.js";

const indexFingerJointIndices = [
  5,
  6,
  7,
  8
];

const extendedThumbJointIndices = [
  0,
  1,
  2,
  3,
  4
];

const middleFingerJointIndices = [
  9,
  10,
  11,
  12
];

const ringFingerJointIndices = [
  13,
  14,
  15,
  16
];

const pinkyFingerJointIndices = [
  17,
  18,
  19,
  20
];

export default function drawHands(
  result, graphics, addObstacle
) {
  const handLandmarks = result?.landmarks;

  if ( !handLandmarks?.length > 0 ?? false ) {
    return;
  }

  const fingersToTrace = [
    extendedThumbJointIndices,
    indexFingerJointIndices,
    middleFingerJointIndices,
    ringFingerJointIndices,
    pinkyFingerJointIndices
  ];

  handLandmarks.forEach( ( hand ) => {
    const fingers = [
    ];

    for ( let fingerToTraceIndex = 0; fingerToTraceIndex < fingersToTrace.length; fingerToTraceIndex++ ) {
      const jointIndices = fingersToTrace[ fingerToTraceIndex ];

      const fingerJointVectors = jointIndices.map( fingerJointIndex => {
        const joint = hand[ fingerJointIndex ];
        const fingerJointVector = createVector(
          inverseX( joint.x ) * width,
          joint.y * height,
          map(
            joint.z,
            0,
            -1,
            0,
            1
          )
        );

        if ( fingerJointIndex === 8 ) {
          if ( addObstacle ) {
            addObstacle(
              createVector.x,
              createVector.y
            );
          }
        }

        return fingerJointVector;
      } );

      const averageFingerZ = fingerJointVectors.reduce(
        (
          sum, {
            z
          }
        ) => (
          sum + z
        ),
        0
      ) / fingerJointVectors.length;

      fingers.push( [
        averageFingerZ,
        fingerJointVectors
      ] );
    }

    // fingers
    //   .sort( (
    //     b, a
    //   ) => a[ 0 ] - b[ 0 ] );

    for ( let fingerIndex = 0; fingerIndex < fingers.length; fingerIndex++ ) {
      const [
        z,
        vectors
      ] = fingers[ fingerIndex ];

      drawNeonLine( {
        innerCircleSize: map(
          z,
          0,
          1,
          10,
          100
        ),
        vectors,
        index: fingerIndex / ( fingers.length - 1 ),
        graphics
      } );
    }
  } );
}

function inverseX(
  x, limit = 1
) {
  return map(
    x,
    0,
    limit,
    limit,
    0
  );
}
