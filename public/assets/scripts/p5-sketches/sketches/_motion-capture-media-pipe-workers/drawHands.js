import neonLine from "./neonLine.js";

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
  handLandmarksArray, graphics
) {
  if ( !handLandmarksArray ) {
    return;
  }

  const fingersToTrace = [
    extendedThumbJointIndices,
    indexFingerJointIndices,
    middleFingerJointIndices,
    ringFingerJointIndices,
    pinkyFingerJointIndices
  ];

  handLandmarksArray.forEach( ( handLandmarkArray ) => {
    const fingers = [
    ];

    for ( let fingerToTraceIndex = 0; fingerToTraceIndex < fingersToTrace.length; fingerToTraceIndex++ ) {
      const jointIndices = fingersToTrace[ fingerToTraceIndex ];

      const fingerJointVectors = jointIndices.map( fingerJointIndex => {
        const joint = handLandmarkArray[ fingerJointIndex ];

        return createVector(
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

      neonLine( {
        innerCircleSize: map(
          z,
          0,
          1,
          10,
          100
        ),
        vectors,
        index: fingerIndex / ( fingersToTrace.length - 1 ),
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
