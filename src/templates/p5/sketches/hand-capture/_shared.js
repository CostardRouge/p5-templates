import {
  getP5
} from "@/p5/utils/sketch.js";

import string from "@/p5/utils/string.js";
import neonDot from "@/p5/utils/visuals/neonDot.js";
import neonLine from "@/p5/utils/visuals/neonLine.js";

import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";

import scripts from "@/p5/utils/scripts.js";
import Matter from "@/public/assets/libraries/matter.min.js";

// Matter's concave-decomposition dependency, loaded once for every
// hand-capture sketch that builds bodies through this module.
scripts.load( "/assets/libraries/decomp.min.js" );

const {
  Engine,
  Bodies,
  Composite,
  Body
} = Matter;

/**
 * Shared physics + rendering controller for the hand-capture sketches.
 *
 * Vision runs through the shared `@/p5/utils/interaction` module — the same one
 * the interaction-test sketch uses — so inference happens in a Web Worker off
 * the draw loop (the old per-sketch `mediapipeInit({ worker: false })` blocked
 * rendering and capped the sketches around 30-40 fps). Any enabled interaction
 * source (camera hands/fingers, mouse, orbit, …) becomes both a physics
 * interactor and a drawn neon stroke.
 *
 * Everything that depends on a tweakable option is (re)built lazily from the
 * draw loop via `sync*` methods, so sliders react live without restarting the
 * sketch. Each `sync*` method holds a signature of its last inputs and rebuilds
 * only when that signature changes; ball count is reconciled incrementally so
 * balls already in flight keep their positions.
 */
export class HandCaptureScene {
  constructor( {
    layers = {},
    boundaryThickness = 50,
    boundaryMargin = 50
  } = {} ) {
    this.engine = Engine.create();
    this.engine.gravity = {
      x: 0,
      y: 0
    };

    this.layers = layers;
    this.boundaryThickness = boundaryThickness;
    this.boundaryMargin = boundaryMargin;

    this.balls = [];
    this.letters = [];
    this.handBodies = [];
    this.boundaries = [];

    // Latest interaction data for the frame, refreshed by readInteraction().
    this.groups = [];
    this.pointers = [];

    this._stageKey = null;
    this._ballSizeKey = null;
    this._letterKey = null;
  }

  /** One-time setup: pre-warm the shared interaction module + layer buffers. */
  async init( interaction = {} ) {
    const p = getP5();

    await initInteraction( interaction );

    for ( const name in this.layers ) {
      this.layers[ name ].graphics = p.createGraphics(
        p.width,
        p.height
      );
    }
  }

  /** Clear the canvas for a new frame. */
  beginFrame( background ) {
    const p = getP5();

    if ( background ) {
      p.background( ...background );
    }
  }

  /**
   * Pull this frame's interaction data once: ordered groups (for drawing) and a
   * flat list of every point (for physics). Reading the grouped form means the
   * points are temporally smoothed and cover every enabled source.
   */
  readInteraction( interaction = {} ) {
    this.groups = getPointerGroups( interaction );
    this.pointers = [];

    for ( const group of this.groups ) {
      for ( const point of group.points ) {
        this.pointers.push( point );
      }
    }
  }

  setGravity( {
    x = 0, y = 0
  } = {} ) {
    this.engine.gravity = {
      x,
      y
    };
  }

  /** Rebuild the four walls whenever the canvas size changes. */
  syncBoundaries() {
    const p = getP5();
    const key = `${ p.width }x${ p.height }`;

    if ( key === this._stageKey ) {
      return;
    }

    this._stageKey = key;

    this._clearBodies( this.boundaries );
    this.boundaries = [];

    const t = this.boundaryThickness;
    const m = this.boundaryMargin;

    this._addBoundary(
      p.width / 2,
      p.height + t / 2 - m,
      p.width,
      t
    );
    this._addBoundary(
      p.width / 2,
      -t / 2 + m,
      p.width,
      t
    );
    this._addBoundary(
      -t / 2 + m,
      p.height / 2,
      t,
      p.height
    );
    this._addBoundary(
      p.width + t / 2 - m,
      p.height / 2,
      t,
      p.height
    );
  }

  /**
   * Reconcile the ball pool to the requested count/size. Count changes are
   * applied incrementally; a size-range change rebuilds the pool so the new
   * range is visible at once.
   */
  syncBalls( {
    count = 0, sizeMin = 20, sizeMax = 50
  } = {} ) {
    const sizeKey = `${ sizeMin }:${ sizeMax }`;

    if ( sizeKey !== this._ballSizeKey ) {
      this._ballSizeKey = sizeKey;

      this._clearBodies( this.balls );
      this.balls = [];
    }

    while ( this.balls.length < count ) {
      this._spawnBall(
        sizeMin,
        sizeMax
      );
    }

    while ( this.balls.length > count ) {
      Composite.remove(
        this.engine.world,
        this.balls.pop()
      );
    }
  }

  /**
   * Turn a string into a pool of letter boxes. Rebuilt when the text or the
   * baked-in body settings (bounciness/friction/size) change.
   */
  syncLetters( {
    text = "", restitution = 0.4, friction = 0.1, size = 100
  } = {} ) {
    const key = `${ text }:${ restitution }:${ friction }:${ size }`;

    if ( key === this._letterKey ) {
      return;
    }

    this._letterKey = key;

    this._clearBodies( this.letters );
    this.letters = [];

    const p = getP5();
    const m = this.boundaryMargin;

    for ( const character of text ) {
      const x = p.random(
        m,
        p.width - m
      );

      const y = p.random(
        m,
        p.height - m
      );

      const body = Bodies.rectangle(
        x,
        y,
        size,
        size,
        {
          restitution,
          friction
        }
      );

      body.label = character;
      body.initialPosition = {
        x,
        y
      };

      this.letters.push( body );

      Composite.add(
        this.engine.world,
        body
      );
    }
  }

  /**
   * Draw every interaction group into the hands layer: multi-point groups
   * (finger chains, body, face) as neon ribbons, single points (fingertips,
   * mouse, orbit, …) as neon dots.
   */
  drawInteraction( {
    innerCircleSize = 50, shadowsCount = 3
  } = {} ) {
    const graphics = this.layers.hands?.graphics;

    if ( !graphics ) {
      return;
    }

    const total = Math.max(
      this.groups.length - 1,
      1
    );

    this.groups.forEach( (
      group, groupIndex
    ) => {
      const index = groupIndex / total;

      if ( group.points.length >= 2 ) {
        neonLine( {
          innerCircleSize,
          shadowsCount,
          vectors: group.points,
          index,
          graphics
        } );
      } else if ( group.points.length === 1 ) {
        neonDot( {
          sizeRange: [
            innerCircleSize,
            innerCircleSize / 3
          ],
          shadowsCount,
          graphics,
          position: group.points[ 0 ],
          index
        } );
      }
    } );
  }

  /** Rebuild the invisible static bodies the balls/letters collide with. */
  syncHandBodies( radius = 75 ) {
    this._clearBodies( this.handBodies );
    this.handBodies = [];

    for ( const point of this.pointers ) {
      const body = Bodies.circle(
        point.x,
        point.y,
        radius,
        {
          isStatic: true,
          isSensor: false
        }
      );

      this.handBodies.push( body );

      Composite.add(
        this.engine.world,
        body
      );
    }
  }

  attract(
    strength = 0.0005, maxForce = 0.002
  ) {
    if ( this.pointers.length === 0 ) {
      return;
    }

    for ( const point of this.pointers ) {
      for ( const ball of this.balls ) {
        this._applyClampedForce(
          ball,
          ( point.x - ball.position.x ) * strength,
          ( point.y - ball.position.y ) * strength,
          maxForce
        );
      }
    }
  }

  repulse(
    strength = 0.5, maxForce = 0.02, distance = 600
  ) {
    if ( this.pointers.length === 0 ) {
      return;
    }

    const maxDistanceSquared = distance * distance;

    for ( const point of this.pointers ) {
      for ( const ball of this.balls ) {
        const dx = ball.position.x - point.x;
        const dy = ball.position.y - point.y;

        if ( dx * dx + dy * dy > maxDistanceSquared ) {
          continue;
        }

        this._applyClampedForce(
          ball,
          dx * strength,
          dy * strength,
          maxForce
        );
      }
    }
  }

  restore(
    bodies, strength = 0.0001, maxForce = 0.003
  ) {
    for ( const body of bodies ) {
      this._applyClampedForce(
        body,
        ( body.initialPosition.x - body.position.x ) * strength,
        ( body.initialPosition.y - body.position.y ) * strength,
        maxForce
      );
    }
  }

  restoreBalls(
    strength, maxForce
  ) {
    this.restore(
      this.balls,
      strength,
      maxForce
    );
  }

  restoreLetters(
    strength, maxForce
  ) {
    this.restore(
      this.letters,
      strength,
      maxForce
    );
  }

  update() {
    Engine.update( this.engine );
  }

  /**
   * Clamp bodies back inside the playable area. Matter lets fast bodies tunnel
   * through the static walls (especially under strong repulsion or a hand push),
   * so this hard guarantee keeps everything on-screen. Position is snapped to
   * the inner edge and the offending velocity component is reflected with light
   * damping so the body bounces back in rather than sticking to the wall.
   */
  containBodies( bodies ) {
    const p = getP5();
    const minX = this.boundaryMargin;
    const minY = this.boundaryMargin;
    const maxX = p.width - this.boundaryMargin;
    const maxY = p.height - this.boundaryMargin;

    for ( const body of bodies ) {
      const radius = body.circleRadius ?? 0;
      const left = minX + radius;
      const right = maxX - radius;
      const top = minY + radius;
      const bottom = maxY - radius;

      let x = body.position.x;
      let y = body.position.y;
      let vx = body.velocity.x;
      let vy = body.velocity.y;
      let changed = false;

      if ( x < left ) {
        x = left;
        vx = Math.abs( vx ) * 0.5;
        changed = true;
      } else if ( x > right ) {
        x = right;
        vx = -Math.abs( vx ) * 0.5;
        changed = true;
      }

      if ( y < top ) {
        y = top;
        vy = Math.abs( vy ) * 0.5;
        changed = true;
      } else if ( y > bottom ) {
        y = bottom;
        vy = -Math.abs( vy ) * 0.5;
        changed = true;
      }

      if ( !changed ) {
        continue;
      }

      Body.setPosition(
        body,
        {
          x,
          y
        }
      );
      Body.setVelocity(
        body,
        {
          x: vx,
          y: vy
        }
      );
    }
  }

  containBalls() {
    this.containBodies( this.balls );
  }

  containLetters() {
    this.containBodies( this.letters );
  }

  renderBalls( {
    shadowsCount = 3, dotScale = 1
  } = {} ) {
    const graphics = this.layers.visuals?.graphics;

    if ( !graphics ) {
      return;
    }

    this.balls.forEach( (
      ball, index
    ) => {
      const size = ball.circleRadius * 2 * dotScale;

      neonDot( {
        sizeRange: [
          size,
          size / 3
        ],
        shadowsCount,
        graphics,
        position: ball.position,
        index: index / this.balls.length
      } );
    } );
  }

  renderLetters( {
    size = 144, font = string.fonts.martian, fill = 0
  } = {} ) {
    const p = getP5();
    const graphics = this.layers.visuals?.graphics;

    if ( !graphics ) {
      return;
    }

    for ( const body of this.letters ) {
      graphics.push();
      graphics.translate(
        body.position.x,
        body.position.y
      );
      graphics.rotate( body.angle );
      graphics.noStroke();
      graphics.fill( fill );
      graphics.textFont( font );
      graphics.textSize( size );
      graphics.textAlign(
        p.CENTER,
        p.CENTER
      );
      graphics.text(
        body.label,
        0,
        0
      );
      graphics.pop();
    }
  }

  /**
   * Trail length for the visuals layer: lower amount fades less per frame, so
   * the neon dots leave longer light trails. `255` clears completely (no trail).
   */
  setTrail( amount ) {
    if ( this.layers.visuals ) {
      this.layers.visuals.fade = amount;
    }
  }

  /** Blit every layer to the canvas, then fade or clear its buffer. */
  compose() {
    const p = getP5();

    for ( const name in this.layers ) {
      const layer = this.layers[ name ];
      const {
        graphics
      } = layer;

      if ( !graphics ) {
        continue;
      }

      p.image(
        graphics,
        0,
        0,
        p.width,
        p.height
      );

      if ( layer.fade === undefined ) {
        graphics.clear();
      } else {
        this._fadeBuffer(
          graphics,
          layer.fade
        );
      }
    }
  }

  drawTitle( {
    title, subtitle, show = true, color
  } = {} ) {
    if ( !show ) {
      return;
    }

    const p = getP5();
    const fill = color ? p.color( ...color ) : p.color( 0 );

    if ( title ) {
      string.write(
        title,
        0,
        p.height / 2,
        {
          size: 172,
          strokeWeight: 0,
          stroke: fill,
          fill,
          font: string.fonts.martian,
          textAlign: [
            p.CENTER,
            p.CENTER
          ],
          blendMode: p.EXCLUSION
        }
      );
    }

    if ( subtitle ) {
      string.write(
        subtitle,
        0,
        ( p.height * 6 ) / 10,
        {
          size: 32,
          strokeWeight: 0,
          stroke: fill,
          fill,
          font: string.fonts.loraItalic,
          textAlign: [
            p.CENTER,
            p.CENTER
          ],
          blendMode: p.EXCLUSION
        }
      );
    }
  }

  _spawnBall(
    sizeMin, sizeMax
  ) {
    const p = getP5();
    const margin = this.boundaryThickness;

    const x = p.random(
      margin,
      p.width - margin
    );

    const y = p.random(
      margin,
      p.height - margin
    );

    const ball = Bodies.circle(
      x,
      y,
      p.random(
        sizeMin,
        sizeMax
      )
    );

    ball.initialPosition = {
      x,
      y
    };

    this.balls.unshift( ball );

    Composite.add(
      this.engine.world,
      ball
    );

    return ball;
  }

  _addBoundary(
    x, y, w, h
  ) {
    const boundary = Bodies.rectangle(
      x,
      y,
      w,
      h,
      {
        isStatic: true
      }
    );

    this.boundaries.push( boundary );

    Composite.add(
      this.engine.world,
      boundary
    );
  }

  _applyClampedForce(
    body, fx, fy, maxForce
  ) {
    const magnitude = Math.sqrt( fx * fx + fy * fy );

    if ( magnitude > maxForce ) {
      fx = ( fx / magnitude ) * maxForce;
      fy = ( fy / magnitude ) * maxForce;
    }

    Body.applyForce(
      body,
      body.position,
      {
        x: fx,
        y: fy
      }
    );
  }

  /** Fade a buffer toward transparent using destination-out compositing. */
  _fadeBuffer(
    graphics, amount
  ) {
    if ( amount >= 255 ) {
      graphics.clear();
      return;
    }

    const context = graphics.drawingContext;

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = `rgba(0, 0, 0, ${ amount / 255 })`;
    context.fillRect(
      0,
      0,
      graphics.width,
      graphics.height
    );
    context.restore();
  }

  _clearBodies( bodies ) {
    for ( const body of bodies ) {
      Composite.remove(
        this.engine.world,
        body
      );
    }
  }
}
