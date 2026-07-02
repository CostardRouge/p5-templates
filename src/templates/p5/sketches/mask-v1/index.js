import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import animation from "@/p5/utils/animation.js";
import events from "@/p5/utils/events.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const shapes = [];

let pixilatedCanvas = null;
let maskImage = null;
let masked = null;
let o = options;

sketch.setup( () => {
  const p = getP5();

  pixilatedCanvas = p.createGraphics(
    p.width,
    p.height
  );

  pixilatedCanvas.pixelDensity( 0.05 );
  pixilatedCanvas.noStroke();

  maskImage = p.createGraphics(
    p.width,
    p.height
  );

  events.register(
    "windowResized",
    () => {
      const p = getP5();

      pixilatedCanvas.width = p.width;
      pixilatedCanvas.height = p.height;
    }
  );

  const xCount = 4;
  const yCount = 4;
  const size = ( p.width + p.height ) / 2 / ( xCount + yCount ) / 3.5;

  for ( let x = 1; x <= xCount; x++ ) {
    for ( let y = 1; y <= yCount; y++ ) {
      shapes.push( new Spiral( {
        size,
        start: p.createVector(
          0,
          -p.height / 3
        ),
        end: p.createVector(
          0,
          p.height / 3
        ),
        relativePosition: {
          x: x / ( xCount + 1 ),
          y: y / ( yCount + 1 )
        }
      } ) );
    }
  }
} );

class Spiral {
  constructor( options ) {
    Object.assign(
      this,
      options
    );
    this.calculateRelativePosition();
  }

  calculateRelativePosition() {
    const p = getP5();

    this.position = p.createVector(
      p.lerp(
        0,
        p.width,
        this.relativePosition.x
      ),
      p.lerp(
        0,
        p.height,
        this.relativePosition.y
      )
    );
  }

  draw(
    index, target, lerpStep = 1 / 800
  ) {
    const p = getP5();

    let {
      position, size, start, end
    } = this;

    // Loop-exact clock: animation.angle (`t`) sweeps exactly TAU per loop.
    // animation.sinAngle == (angle - PI) / 2 and animation.cosAngle ==
    // (angle + TAU) / 2, so `k * sinAngle` / `k * cosAngle` only return to
    // their start value when k / 2 is a WHOLE number of turns of `angle` —
    // snap each occurrence's k / 2 to the nearest whole turn. A bare
    // `animation.progression` term (rate 1, i.e. one TAU-th of a turn per
    // loop) is far below one whole turn, so it snaps to 0 turns.
    const t = animation.angle;
    const waveTurns = Math.round( 5 / 2 );
    const opacityTurns = Math.round( 3 / 2 );
    const xOffsetSinTurns = Math.round( 2 / 2 );
    const xOffsetProgTurns = Math.round( 2 / p.TAU );
    const yOffsetCosTurns = Math.round( 3 / 2 );
    const yOffsetProgTurns = Math.round( 1 / p.TAU );
    const sizeProgTurns = Math.round( 1 / p.TAU );
    const colorSinTurns = Math.round( 1 / 2 );
    const colorCosTurns = Math.round( 2 / 2 );

    target.push();
    target.translate(
      position.x,
      position.y
    );

    for ( let lerpIndex = 0; lerpIndex < 1; lerpIndex += lerpStep ) {
      const waveAmplitude =
        size *
        mappers.fn(
          Math.sin( lerpIndex * 2 + waveTurns * ( t - p.PI ) ),
          -1,
          1,
          0.8,
          1.25,
          easing.easeInOutBack
        );
      const f = 70;
      const opacityFactor = target.map(
        lerpIndex,
        0,
        1,
        target.map(
          Math.sin( lerpIndex * f + opacityTurns * ( t - p.PI ) ),
          -1,
          1,
          1,
          2
        ),
        1
      );

      const lerpPosition = mappers.lerpVector(
        start,
        end,
        lerpIndex
      );

      const xOffset = mappers.fn(
        Math.sin( xOffsetSinTurns * ( t - p.PI ) +
            xOffsetProgTurns * t +
            8 * lerpIndex ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude,
        easing.easeInOutExpo
      );
      const yOffset = mappers.fn(
        Math.cos( yOffsetCosTurns * ( t + p.TAU ) + yOffsetProgTurns * t + 8 * lerpIndex ),
        -1,
        1,
        -waveAmplitude,
        waveAmplitude,
        easing.easeInSine
      );

      const s = mappers.fn(
        Math.sin( sizeProgTurns * t + 8 * lerpIndex * lerpIndex * -5 ),
        -1,
        1,
        40,
        90,
        easing.easeInOutSine
      );
      const c = 5; // mappers.fn(Math.sin(animation.sinAngle+ 8 *lerpIndex), -1, 1, 3, 5, easing.easeInOutExpo);

      for ( let i = 0; i < c; i++ ) {
        const x = target.lerp(
          lerpPosition.x + xOffset, //* 1.5,
          lerpPosition.y - yOffset,
          i / c
        );
        const y = target.lerp(
          lerpPosition.y + yOffset,
          lerpPosition.x - xOffset,
          i / c
        );

        const a = lerpIndex * lerpIndex * 16 + i;

        target.fill(
          // colors.rainbow({
          //   hueOffset: i*2,
          //   hueIndex: p.map(p.noise(lerpIndex, x/p.width, y/p.height), 0, 1, -p.PI, p.PI)*2,
          //   opacityFactor
          // })
          target.map(
            Math.sin( lerpIndex * a + colorSinTurns * ( t - p.PI ) ),
            -1,
            1,
            0,
            360
          ) /
            opacityFactor,
          target.map(
            Math.cos( lerpIndex * a - colorCosTurns * ( t + p.TAU ) ),
            -1,
            1,
            0,
            255
          ) /
            opacityFactor,
          target.map(
            Math.sin( lerpIndex * a + colorSinTurns * ( t - p.PI ) ),
            -1,
            1,
            255,
            0
          ) /
            opacityFactor
        );

        target.circle(
          x,
          y,
          s
        );

        target.circle(
          target.constrain(
            x,
            -target.width / 2 + 90 * 2,
            target.width / 2 - 90 * 2
          ),
          target.constrain(
            y,
            0,
            target.height
          ),
          s
        );
      }
    }

    target.pop();
  }
}

sketch.draw( () => {
  const p = getP5();

  p.noStroke();
  p.noSmooth();
  p.clear();
  p.background( 0 );

  shapes[ 0 ].draw(
    1,
    p,
    1 / 500
  );

  pixilatedCanvas.background( 0 );
  shapes[ 0 ].draw(
    1,
    pixilatedCanvas,
    1 / 300
  );

  // pixilatedCanvas.background(
  //   0,
  //   0,
  //   0,
  //   32
  // );

  const position = p.createVector(
    p.mouseX,
    p.mouseY
  );

  const strokeSize = 3;
  const w = p.width;
  const h = p.height;

  // position.x = p.width/2
  // position.y = p.map(p.cos(animation.cosAngle), -1, 1, 0, p.height)

  // position.x = p.map(p.sin(animation.sinAngle), -1, 1, w/2+strokeSize/2, p.width-w/2-strokeSize/2)
  // position.y = p.map(p.cos(animation.cosAngle/3), -1, 1, h/2+strokeSize/2, p.height-h/2-strokeSize/2)

  // Loop-exact clock: same sinAngle/cosAngle -> whole-turns substitution as
  // in Spiral.draw() above.
  const maskT = animation.angle;
  const maskXTurns = Math.round( 5 / 2 );
  const maskYTurns = Math.round( 1 / 2 );

  position.x = p.map(
    p.sin( maskXTurns * ( maskT - p.PI ) ),
    -1,
    1,
    20,
    p.width - 20
  );
  position.y = p.map(
    p.cos( maskYTurns * ( maskT + p.TAU ) ),
    -1,
    1,
    20,
    p.height - 20
  );

  maskImage.erase();
  maskImage.rect(
    0,
    0,
    p.width,
    p.height
  );
  maskImage.noErase();

  maskImage.beginShape();
  maskImage.vertex(
    position.x - w / 2,
    position.y - h / 2
  );
  maskImage.vertex(
    position.x + w / 2,
    position.y - h / 2
  );
  maskImage.vertex(
    position.x + w / 2,
    position.y + h / 2
  );
  maskImage.vertex(
    position.x - w / 2,
    position.y + h / 2
  );
  maskImage.endShape( p.CLOSE );

  ( masked = pixilatedCanvas.get() ).mask( maskImage );
  p.image(
    masked,
    0,
    0
  );

  p.noFill();
  p.stroke(
    128,
    128,
    255
  );
  p.stroke(
    128,
    128,
    255
  );
  p.strokeWeight( strokeSize );

  p.beginShape();
  p.vertex(
    p.constrain(
      position.x - w / 2,
      0,
      p.width
    ),
    p.constrain(
      position.y - h / 2,
      0,
      p.height
    )
  );
  p.vertex(
    p.constrain(
      position.x + w / 2,
      0,
      p.width
    ),
    p.constrain(
      position.y - h / 2,
      0,
      p.height
    )
  );
  p.vertex(
    p.constrain(
      position.x + w / 2,
      0,
      p.width
    ),
    p.constrain(
      position.y + h / 2,
      0,
      p.height
    )
  );
  p.vertex(
    p.constrain(
      position.x - w / 2,
      0,
      p.width
    ),
    p.constrain(
      position.y + h / 2,
      0,
      p.height
    )
  );
  p.endShape( p.CLOSE );
} );
