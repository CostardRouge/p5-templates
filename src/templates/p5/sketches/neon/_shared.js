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

export function makeStartEnd( axis ) {
  const p = getP5();

  if ( axis === "horizontal" ) {
    return {
      start: p.createVector(
        -p.width / 2,
        0
      ),
      end: p.createVector(
        p.width / 2,
        0
      )
    };
  }
  if ( axis === "diagonal" ) {
    return {
      start: p.createVector(
        -p.width / 2,
        -p.height / 2
      ),
      end: p.createVector(
        p.width / 2,
        p.height / 2
      )
    };
  }

  return {
    start: p.createVector(
      0,
      -p.height / 2
    ),
    end: p.createVector(
      0,
      p.height / 2
    )
  };
}

export function rebuildGrid( {
  state,
  options,
  SpiralClass,
  layoutKeySuffix = "",
  extraProps = () => ( {} )
} ) {
  const p = getP5();
  const layout = options?.layout ?? {};

  const xCount = layout.xCount ?? 1;
  const yCount = layout.yCount ?? 1;
  const sizeDivisor = layout.sizeDivisor ?? 3.5;
  const axis = layout.axis ?? "vertical";

  const key = `${ xCount }x${ yCount }-${ sizeDivisor }-${ axis }-${ p.width }x${ p.height }-${ layoutKeySuffix }`;

  if ( key === state.lastLayout ) {
    return;
  }
  state.lastLayout = key;

  const size = ( p.width + p.height ) / 2 / ( xCount + yCount ) / sizeDivisor;
  const startEnd = makeStartEnd( axis );

  state.shapes = [];

  for ( let x = 1; x <= xCount; x++ ) {
    for ( let y = 1; y <= yCount; y++ ) {
      state.shapes.push( new SpiralClass( {
        size,
        ...startEnd,
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

export const LAYOUT_FORM = {
  component: "nested-object",
  label: "Layout",
  fields: {
    xCount: {
      label: "X count",
      component: "slider",
      min: 1,
      max: 10,
      step: 1
    },
    yCount: {
      label: "Y count",
      component: "slider",
      min: 1,
      max: 10,
      step: 1
    },
    sizeDivisor: {
      label: "Size divisor",
      component: "slider",
      min: 1,
      max: 12,
      step: 0.1
    },
    axis: {
      label: "Axis",
      component: "select",
      options: [
        {
          label: "Vertical",
          value: "vertical"
        },
        {
          label: "Horizontal",
          value: "horizontal"
        },
        {
          label: "Diagonal",
          value: "diagonal"
        }
      ]
    }
  }
};
