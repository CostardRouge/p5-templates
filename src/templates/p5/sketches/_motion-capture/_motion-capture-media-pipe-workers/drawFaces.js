import drawNeonLine from "./drawNeonLine.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const rightEye = 0;
const leftEye = 1;
const nose = 2;
const mouth = 3;
const rightEar = 4;
const leftEar = 5;

const getZoomFromFace = ( face ) => {
  if ( !face || face.length < 6 ) return 0;

  const dEyes = getP5().Vector.dist(
    face[ 0 ],
    face[ 1 ]
  ); // right eye to left eye
  const dEars = getP5().Vector.dist(
    face[ 4 ],
    face[ 5 ]
  ); // right ear to left ear
  const dNoseMouth = getP5().Vector.dist(
    face[ 2 ],
    face[ 3 ]
  ); // nose to mouth

  const avgDist = ( dEyes + dEars + dNoseMouth ) / 3;

  const minDist = 20;
  const maxDist = 120;

  return p.constrain(
    p.map(
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

  p.noFill();
  p.stroke(
    0,
    0,
    255
  );
  p.strokeWeight( 5 );

  result.forEach( ( detection ) => {
    // const boundingBox = detection.boundingBox;
    const keyPointVectors = detection.keypoints.map( ( faceKeyPoint ) => {
      return p.createVector(
        inverseX( faceKeyPoint.x ) * p.width,
        faceKeyPoint.y * p.height,
        faceKeyPoint.z
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
      position: keyPointVectors[ nose ]
    } );

    // p.beginShape( p.POINTS );
    // keypoints.forEach( ( keypoint ) => {
    //   p.vertex(
    //     inverseX( keypoint.x ) * p.width,
    //     keypoint.y * p.height
    //   );
    // } );
    // p.strokeWeight( 10 );
    // p.endShape();
  } );
}
