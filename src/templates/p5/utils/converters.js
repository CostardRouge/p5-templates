import {
  getP5
} from "./sketch.js";

const converters = {
  polar: {
    get: function(
      func, size, angle, coefficient = 1
    ) {
      return size * func( angle * coefficient );
    },
    vector: function(
      angle, sizeX, sizeY = sizeX
    ) {
      const p = getP5();

      return p.createVector(
        this.get(
          p.sin.bind( p ),
          sizeX,
          angle
        ),
        this.get(
          p.cos.bind( p ),
          sizeY,
          angle
        )
      );
    },
  },
};

export default converters;
