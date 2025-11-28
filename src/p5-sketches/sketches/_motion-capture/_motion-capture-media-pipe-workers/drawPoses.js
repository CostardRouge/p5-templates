import drawNeonLine from "./drawNeonLine.js";

const leftLegIndices = [
  24,
  26,
  28
];

const rightLegIndices = [
  23,
  25,
  27
];

const chestIndices = [
  11,
  12,
  24,
  23,
  11
];

const leftArmIndices = [
  12,
  14,
  16,
  // 18,
  // 20,
  // 22,
  // 16
];

const rightArmIndices = [
  11,
  13,
  15,
  // 17,
  // 19,
  // 21,
  // 15
];

const faceIndices = [
  8,
  6,
  5,
  4,
  0,
  1,
  2,
  3,
  7
];

const mouthIndices = [
  10,
  9
];

export default function drawPoses(
  result, graphics
) {
  const poseLandmarks = result?.landmarks;

  if ( !poseLandmarks?.length > 0 ?? false ) {
    return;
  }

  const bodyPartsToTrace = [
    leftLegIndices,
    rightLegIndices,
    chestIndices,
    leftArmIndices,
    rightArmIndices,
    faceIndices,
    mouthIndices
  ];

  poseLandmarks.forEach( ( pose ) => {
    const bodyParts = [
    ];

    for ( let bodyPartToTraceIndex = 0; bodyPartToTraceIndex < bodyPartsToTrace.length; bodyPartToTraceIndex++ ) {
      const bodyPartJoinIndices = bodyPartsToTrace[ bodyPartToTraceIndex ];

      const bodyPartJointVectors = bodyPartJoinIndices.map( bodyPartJoinIndex => {
        const joint = pose[ bodyPartJoinIndex ];

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

      const averageJointZ = bodyPartJointVectors.reduce(
        (
          sum, {
            z
          }
        ) => (
          sum + z
        ),
        0
      ) / bodyPartJointVectors.length;

      bodyParts.push( [
        averageJointZ,
        bodyPartJointVectors
      ] );
    }

    bodyParts
      .sort( (
        b, a
      ) => a[ 0 ] - b[ 0 ] );

    for ( let bodyPartIndex = 0; bodyPartIndex < bodyParts.length; bodyPartIndex++ ) {
      const [
        z,
        vectors
      ] = bodyParts[ bodyPartIndex ];

      drawNeonLine( {
        innerCircleSize: map(
          z,
          0,
          1,
          5,
          10
        ),
        // innerCircleSize: 30,
        vectors,
        vectorsStep: 0.01,
        index: bodyPartIndex / ( bodyParts.length - 1 ),
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
