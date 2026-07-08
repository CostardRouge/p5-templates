import {
  getP5
} from "@/p5/utils/sketch.js";

export class SpiralBase {
  constructor( opts ) {
    Object.assign(
      this,
      opts
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
}

export function rebuildGrid( {
  state, options, SpiralClass, layoutKeySuffix = "", extraProps = () => ( {} )
} ) {
  const p = getP5();
  const layout = options?.layout ?? {};

  const xCount = layout.xCount ?? 1;
  const yCount = layout.yCount ?? 1;
  const sizeDivisor = layout.sizeDivisor ?? 3;

  const key = `${ xCount }x${ yCount }-${ sizeDivisor }-${ p.width }x${ p.height }-${ layoutKeySuffix }`;

  if ( key === state.lastLayout ) {
    return;
  }
  state.lastLayout = key;

  const size = ( p.width + p.height ) / 2 / ( xCount + yCount ) / sizeDivisor;

  state.shapes = [];

  for ( let x = 1; x <= xCount; x++ ) {
    for ( let y = 1; y <= yCount; y++ ) {
      state.shapes.push( new SpiralClass( {
        size,
        relativePosition: {
          x: x / ( xCount + 1 ),
          y: y / ( yCount + 1 )
        },
        ...extraProps( {
          x,
          y,
          xCount,
          yCount,
          size
        } )
      } ) );
    }
  }
}

