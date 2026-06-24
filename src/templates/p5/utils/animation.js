import mappers from "./mappers.js";
import sketch from "./sketch.js";
import time from "./time.js";
import {
  getP5
} from "./sketch.js";
import {
  resolveAnimation, totalFramesFor
} from "@/lib/animationConfig";

const animation = {
  animate: (
    fn, duration, onProgress, onComplete
  ) => {
    const start = performance.now();

    const animate = ( time ) => {
      const timeFraction = ( time - start ) / duration;
      const timeProgression = timeFraction > 1 ? 1 : timeFraction;

      onProgress( fn( timeProgression ) );

      if ( timeProgression < 1 ) {
        requestAnimationFrame( animate );
      } else {
        onComplete();
      }
    };

    requestAnimationFrame( animate );
  },

  get maximumFramesCount() {
    return totalFramesFor( sketch.sketchOptions?.animation );
  },

  get progression() {
    const {
      duration
    } = resolveAnimation( sketch.sketchOptions?.animation );
    const seconds = time.seconds();

    // During recording, don't wrap and don't cap - progression should match frame count
    if ( time.isRecording ) {
      return seconds / duration;
    }

    // Normal playback: wrap around for continuous loop
    return ( seconds % duration ) / duration;
  },
  get circularProgression() {
    return mappers.circular(
      animation.progression,
      0,
      1
    );
  },
  triangleProgression: ( speedFactor = 1 ) => {
    const progress = ( animation.progression * speedFactor ) % 1;

    return progress < 0.5
      ? progress * 2 // Linear up (0 → 1)
      : ( 1 - progress ) * 2; // Linear down (1 → 0)
  },
  linearProgression: ( speedFactor = 1 ) => {
    return ( animation.progression * speedFactor ) % 1;
  },
  get noiseProgression() {
    return getP5().noise( animation.circularProgression );
  },

  get angle() {
    return animation.progression * getP5().TAU;
  },

  get sinAngle() {
    const p = getP5();

    return p.map(
      animation.progression,
      0,
      1,
      -p.PI / 2,
      p.PI / 2
    );
  },
  get cosAngle() {
    const p = getP5();

    return p.map(
      animation.progression,
      0,
      1,
      p.PI,
      p.TAU
    );
  },

  sinOscillation( speedFactor = 1 ) {
    return Math.sin( animation.angle * speedFactor );
  },
  cosOscillation( speedFactor = 1 ) {
    return Math.cos( animation.angle * speedFactor );
  },
  get linearOscillation() {
    const p = getP5();
    const progression = animation.progression;

    if ( progression < 0.5 ) {
      return p.map(
        progression,
        0,
        0.5,
        -1,
        1
      ); // Forward phase
    }

    return p.map(
      progression,
      0.5,
      1,
      1,
      -1
    ); // Backward phase
  },

  ease: ( {
    values,
    currentTime,
    duration = 1,
    easingFn = ( x ) => x,
    lerpFn,
    startIndex = currentTime,
    endIndex = currentTime + 1
  } ) => {
    const p = getP5();

    const _lerpFn = lerpFn ?? p.lerp.bind( p );

    return _lerpFn(
      mappers.circularIndex(
        startIndex,
        values
      ),
      mappers.circularIndex(
        endIndex,
        values
      ),
      easingFn( ( currentTime * duration ) % duration )
    );
  },
  makeEaseInOut:
    (
      inFn, outFn = inFn
    ) =>
      ( timeFraction ) => {
        if ( timeFraction < 0.5 ) {
          return inFn( 2 * timeFraction ) / 2;
        } else {
          return ( 2 - outFn( 2 * ( 1 - timeFraction ) ) ) / 2;
        }
      },
  sequence: function(
    key, speed, values, amount = 0.07, lerpFn
  ) {
    const _lerpFn = lerpFn ?? getP5().lerp.bind( getP5() );

    this.values = this.values ?? {};

    const newValue = mappers.circularIndex(
      speed,
      values
    );
    const currentSavedValue = this.values[ key ] ? this.values[ key ] : newValue;

    return ( this.values[ key ] = _lerpFn(
      currentSavedValue,
      newValue,
      amount
    ) );
  }
};

export default animation;
