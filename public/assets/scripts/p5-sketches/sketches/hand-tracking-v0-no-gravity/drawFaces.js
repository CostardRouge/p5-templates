import drawNeonLine from "./drawNeonLine.js";

const rightEye = 0;
const leftEye = 1;
const nose = 2;
const mouth = 3;
const rightEar = 4;
const leftEar = 5;

const getZoomFromFace = ( face ) => {
  if ( !face || face.length < 6 ) return 0;

  const dEyes = p5.Vector.dist(
    face[ 0 ],
    face[ 1 ]
  ); // right eye to left eye
  const dEars = p5.Vector.dist(
    face[ 4 ],
    face[ 5 ]
  ); // right ear to left ear
  const dNoseMouth = p5.Vector.dist(
    face[ 2 ],
    face[ 3 ]
  ); // nose to mouth

  const avgDist = ( dEyes + dEars + dNoseMouth ) / 3;

  const minDist = 20;
  const maxDist = 120;

  return constrain(
    map(
      avgDist,
      minDist,
      maxDist,
      0,
      1
    ),
    0,
    1
  );
};

export default function drawFace(
  result, graphics
) {
  if ( !result ) {
    return;
  }

  noFill();
  stroke(
    0,
    0,
    255
  );
  strokeWeight( 5 );

  result.forEach( ( detection ) => {
    // const boundingBox = detection.boundingBox;
    const keyPointVectors = detection.keypoints.map( faceKeyPoint => {
      return createVector(
        inverseX( faceKeyPoint.x ) * width,
        faceKeyPoint.y * height,
        faceKeyPoint.z,
      );
    } );

    const faceZoom = getZoomFromFace( keyPointVectors );
    const size = mappers.fn(
      faceZoom,
      0,
      1,
      10,
      750,
      easing.easeInExpo
    );

    drawCircleEchoes( {
      size,
      count: 30,
      position: keyPointVectors[ nose ],
    } );

    // beginShape( POINTS );
    // keypoints.forEach( ( keypoint ) => {
    //   vertex(
    //     inverseX( keypoint.x ) * width,
    //     keypoint.y * height
    //   );
    // } );
    // strokeWeight( 10 );
    // endShape();
  } );
}