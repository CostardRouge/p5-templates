import {
  getP5
} from "@/p5/utils/sketch.js";

import string from "@/p5/utils/string.js";
import neonDot from "@/p5/utils/visuals/neonDot.js";
import neonLine from "@/p5/utils/visuals/neonLine.js";

import {
  renderSplines
} from "../splines/_shared.js";

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

// Shortest distance from a point to a line segment — used for blade hit-tests.
function _segmentDistance(
  px, py, x1, y1, x2, y2
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if ( lengthSquared === 0 ) {
    return Math.hypot(
      px - x1,
      py - y1
    );
  }

  let t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / lengthSquared;

  t = Math.max(
    0,
    Math.min(
      1,
      t
    )
  );

  const projectionX = x1 + t * dx;
  const projectionY = y1 + t * dy;

  return Math.hypot(
    px - projectionX,
    py - projectionY
  );
}

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
    this._rainAccumulator = 0;
    this._tossAccumulator = 0;
    this._prevPoints = new Map();
    this._echoHistory = [];
    this._echoFrame = 0;
    this._echoLayer = null;
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

  /** Add a single ball at an explicit position (used by the spawners). */
  addBall( {
    x = 0, y = 0, radius = 30
  } = {} ) {
    const ball = Bodies.circle(
      x,
      y,
      radius
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

  /**
   * Spawn falling balls from just above the top edge at `rate` per second. The
   * accumulator keeps the rate frame-rate independent.
   */
  spawnRain( {
    rate = 6, sizeMin = 20, sizeMax = 40
  } = {} ) {
    const p = getP5();
    const margin = this.boundaryMargin;
    const dt = Math.min(
      p.deltaTime,
      100
    ) / 1000;

    this._rainAccumulator += rate * dt;

    while ( this._rainAccumulator >= 1 ) {
      this._rainAccumulator -= 1;

      const radius = p.random(
        sizeMin,
        sizeMax
      );

      this.addBall( {
        x: p.random(
          margin,
          p.width - margin
        ),
        y: -radius * 2,
        radius
      } );
    }
  }

  /**
   * Remove every ball within `radius` of any interaction pointer. Returns the
   * number caught this frame.
   */
  catchNearPointers( {
    radius = 80
  } = {} ) {
    if ( this.pointers.length === 0 ) {
      return 0;
    }

    const radiusSquared = radius * radius;
    let caught = 0;

    for ( let i = this.balls.length - 1; i >= 0; i-- ) {
      const ball = this.balls[ i ];

      for ( const point of this.pointers ) {
        const dx = ball.position.x - point.x;
        const dy = ball.position.y - point.y;

        if ( dx * dx + dy * dy > radiusSquared ) {
          continue;
        }

        Composite.remove(
          this.engine.world,
          ball
        );
        this.balls.splice(
          i,
          1
        );
        caught++;
        break;
      }
    }

    return caught;
  }

  /**
   * Remove balls that have left the canvas. Returns how many fell past the
   * bottom edge (a "missed" count); side exits are cleaned up silently.
   */
  cullOffscreen( {
    margin = 100
  } = {} ) {
    const p = getP5();
    let missed = 0;

    for ( let i = this.balls.length - 1; i >= 0; i-- ) {
      const ball = this.balls[ i ];
      const belowBottom = ball.position.y > p.height + margin;
      const offSide = ball.position.x < -margin || ball.position.x > p.width + margin;

      if ( !belowBottom && !offSide ) {
        continue;
      }

      Composite.remove(
        this.engine.world,
        ball
      );
      this.balls.splice(
        i,
        1
      );

      if ( belowBottom ) {
        missed++;
      }
    }

    return missed;
  }

  /**
   * Lob balls up from below the bottom edge at `rate` per second, like tossed
   * fruit. Gravity (set by the sketch) pulls them back into an arc.
   */
  tossBalls( {
    rate = 1.2, sizeMin = 45, sizeMax = 75, speed = 30, spread = 6
  } = {} ) {
    const p = getP5();
    const dt = Math.min(
      p.deltaTime,
      100
    ) / 1000;

    this._tossAccumulator += rate * dt;

    while ( this._tossAccumulator >= 1 ) {
      this._tossAccumulator -= 1;

      const radius = p.random(
        sizeMin,
        sizeMax
      );

      const ball = this.addBall( {
        x: p.random(
          p.width * 0.2,
          p.width * 0.8
        ),
        y: p.height + radius,
        radius
      } );

      Body.setVelocity(
        ball,
        {
          x: p.random(
            -spread,
            spread
          ),
          y: -speed
        }
      );
    }
  }

  /**
   * Slice balls crossed by a fast pointer swipe. A blade is the segment a
   * tracked point travelled since last frame; only swipes faster than
   * `minSpeed` cut. A sliced ball splits into two smaller halves flying apart,
   * down to `minRadius` (below which it is destroyed). Returns the slice count.
   */
  sliceBalls( {
    minSpeed = 25, bladeWidth = 20, minRadius = 16, splitSpeed = 6
  } = {} ) {
    const current = new Map();
    const blades = [];

    for ( const group of this.groups ) {
      group.points.forEach( (
        point, pointIndex
      ) => {
        const key = `${ group.id }:${ pointIndex }`;

        current.set(
          key,
          {
            x: point.x,
            y: point.y
          }
        );

        const previous = this._prevPoints.get( key );

        if ( !previous ) {
          return;
        }

        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.hypot(
          dx,
          dy
        );

        if ( length >= minSpeed ) {
          blades.push( {
            x1: previous.x,
            y1: previous.y,
            x2: point.x,
            y2: point.y,
            dx,
            dy,
            length
          } );
        }
      } );
    }

    this._prevPoints = current;

    if ( blades.length === 0 ) {
      return 0;
    }

    const children = [];
    let sliced = 0;

    for ( let i = this.balls.length - 1; i >= 0; i-- ) {
      const ball = this.balls[ i ];
      const radius = ball.circleRadius ?? 0;
      const blade = this._bladeHitting(
        ball,
        radius,
        blades,
        bladeWidth
      );

      if ( !blade ) {
        continue;
      }

      Composite.remove(
        this.engine.world,
        ball
      );
      this.balls.splice(
        i,
        1
      );
      sliced++;

      if ( radius <= minRadius ) {
        continue;
      }

      const perpX = -blade.dy / blade.length;
      const perpY = blade.dx / blade.length;
      const childRadius = radius * 0.62;

      for ( const sign of [
        1,
        -1
      ] ) {
        children.push( {
          x: ball.position.x + perpX * childRadius * sign,
          y: ball.position.y + perpY * childRadius * sign,
          radius: childRadius,
          vx: ball.velocity.x + perpX * splitSpeed * sign,
          vy: ball.velocity.y + perpY * splitSpeed * sign
        } );
      }
    }

    for ( const child of children ) {
      const body = this.addBall( {
        x: child.x,
        y: child.y,
        radius: child.radius
      } );

      Body.setVelocity(
        body,
        {
          x: child.vx,
          y: child.vy
        }
      );
    }

    return sliced;
  }

  _bladeHitting(
    ball, radius, blades, bladeWidth
  ) {
    for ( const blade of blades ) {
      const distance = _segmentDistance(
        ball.position.x,
        ball.position.y,
        blade.x1,
        blade.y1,
        blade.x2,
        blade.y2
      );

      if ( distance <= bladeWidth + radius ) {
        return blade;
      }
    }

    return null;
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
    innerCircleSize = 50, shadowsCount = 3, vectorsStep = 0.05
  } = {} ) {
    const graphics = this.layers.hands?.graphics;

    if ( !graphics ) {
      return;
    }

    this._drawGroupsTo(
      graphics,
      this.groups,
      1,
      {
        innerCircleSize,
        shadowsCount,
        vectorsStep
      }
    );
  }

  /**
   * Onion-skin "echo": redraw the last `count` hand poses (sampled every
   * `spacing` frames) with rising opacity, then the live hand on top — each
   * hand leaves a fading ghost of itself. This is the original CPU `neonLine`
   * renderer used by `hand-tracking-v7-echo`; the GPU spline + feedback variant
   * lives in `drawGrowingEcho` (see `hand-tracking-v8-growing`).
   */
  drawEchoes( {
    count = 6,
    spacing = 4,
    innerCircleSize = 30,
    shadowsCount = 2,
    vectorsStep = 0.08,
    minAlpha = 0.1,
    ghostAlpha = 0.55
  } = {} ) {
    const graphics = this.layers.hands?.graphics;

    if ( !graphics ) {
      return;
    }

    this._echoFrame += 1;

    if ( this._echoFrame % Math.max(
      spacing,
      1
    ) === 0 ) {
      this._echoHistory.push( this._snapshotGroups() );

      while ( this._echoHistory.length > count ) {
        this._echoHistory.shift();
      }
    }

    const drawOptions = {
      innerCircleSize,
      shadowsCount,
      vectorsStep
    };
    const last = Math.max(
      this._echoHistory.length - 1,
      1
    );

    this._echoHistory.forEach( (
      snapshot, i
    ) => {
      const alpha = minAlpha + ( ghostAlpha - minAlpha ) * ( i / last );

      this._drawGroupsTo(
        graphics,
        snapshot,
        alpha,
        drawOptions
      );
    } );

    this._drawGroupsTo(
      graphics,
      this.groups,
      1,
      drawOptions
    );
  }

  /**
   * Feedback "growing echo": the live hand is drawn ONCE per frame with the
   * shader-based spline pipeline (GPU glow, rainbow gradient computed in the
   * fragment shader), and the trail is produced by a single canvas-to-canvas
   * copy of a persistent buffer rather than by re-stroking every past pose.
   *
   * That is the key difference from the discrete onion-skin: re-running Chaikin
   * + a GPU pass for every ghost made the cost scale with the ghost count. Here
   * each frame ages the accumulator with one `drawImage` (fade + transform),
   * stamps the freshly drawn hand into it, and blits it — O(1) in trail length.
   *
   * The `effect` shapes how the accumulator is transformed every frame:
   *   - up / down / left / right → drift the whole trail `speed` px that way, so
   *     the echo stretches into a comet streak toward that edge.
   *   - grow → scale the trail up by `scale` about the centre and darken it by
   *     `darken`, so each copy blooms slightly bigger and dimmer behind the hand.
   *
   * `decay` (0..1) is how much of the buffer survives each frame — higher keeps a
   * longer trail. Lower `decay` fades the echo away faster.
   */
  drawGrowingEcho( {
    background = [
      0
    ],
    weight = 18,
    glow = 2,
    iterations = 6,
    hueSpeed = 1.5,
    hueSpread = 2,
    decay = 0.9,
    effect = "up",
    speed = 8,
    scale = 1.03,
    darken = 0.12
  } = {} ) {
    const p = getP5();
    const layer = this._ensureEchoLayer();
    const ctx = layer.drawingContext;

    // 1. Age the existing echoes with a single self-copy: fade by `decay` and
    //    push them along the effect, so every past frame drifts/zooms a little
    //    further out and dimmer. One canvas blit, independent of trail length.
    ctx.save();
    ctx.globalCompositeOperation = "copy";
    ctx.globalAlpha = decay;
    this._applyEchoTransform(
      ctx,
      effect,
      speed,
      scale
    );
    ctx.drawImage(
      ctx.canvas,
      0,
      0
    );
    ctx.restore();

    // The "grow" effect also darkens each generation (source-atop only touches
    // the pixels that are already there, so the trail's shape/alpha is kept).
    if ( effect === "grow" && darken > 0 ) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(0, 0, 0, ${ darken })`;
      ctx.fillRect(
        0,
        0,
        layer.width,
        layer.height
      );
      ctx.restore();
    }

    // 2. Draw the live hand fresh onto the (cleared) main canvas with the GPU
    //    spline pipeline, then stamp it into the accumulator at full brightness
    //    so it becomes next frame's newest — and brightest — echo.
    p.clear();
    this._renderHandSplines(
      this.groups,
      {
        weight,
        glow,
        iterations,
        hueSpeed,
        hueSpread
      }
    );

    ctx.drawImage(
      p.drawingContext.canvas,
      0,
      0
    );

    // 3. Final frame: repaint the background (the live-hand pass cleared it) and
    //    lay the accumulator — aged echoes plus the crisp live hand — on top.
    p.background( ...background );
    p.image(
      layer,
      0,
      0
    );
  }

  /** Lazily build / resize the persistent buffer the growing echo accumulates into. */
  _ensureEchoLayer() {
    const p = getP5();

    if ( !this._echoLayer
      || this._echoLayer.width !== p.width
      || this._echoLayer.height !== p.height ) {
      this._echoLayer = p.createGraphics(
        p.width,
        p.height
      );
    }

    return this._echoLayer;
  }

  /** Transform the accumulator for one ageing step, per the chosen effect. */
  _applyEchoTransform(
    ctx, effect, speed, scale
  ) {
    const p = getP5();

    if ( effect === "grow" ) {
      const cx = p.width / 2;
      const cy = p.height / 2;

      ctx.translate(
        cx,
        cy
      );
      ctx.scale(
        scale,
        scale
      );
      ctx.translate(
        -cx,
        -cy
      );

      return;
    }

    if ( effect === "up" ) {
      ctx.translate(
        0,
        -speed
      );
    } else if ( effect === "down" ) {
      ctx.translate(
        0,
        speed
      );
    } else if ( effect === "left" ) {
      ctx.translate(
        -speed,
        0
      );
    } else if ( effect === "right" ) {
      ctx.translate(
        speed,
        0
      );
    }
  }

  /**
   * Draw the live hand once onto the main canvas: every multi-point group
   * (finger chains, body, …) as a glowing spline, every lone point (a single
   * fingertip / mouse / orbit) as a neon dot. Batched into one GPU pass.
   */
  _renderHandSplines(
    groups, {
      weight, glow, iterations, hueSpeed, hueSpread
    }
  ) {
    const lists = [];

    for ( const group of groups ) {
      const {
        points
      } = group;

      if ( points.length >= 2 ) {
        lists.push( points );
      } else if ( points.length === 1 ) {
        neonDot( {
          sizeRange: [
            weight * 1.6,
            weight * 0.5
          ],
          shadowsCount: Math.max(
            1,
            glow + 1
          ),
          position: points[ 0 ],
          index: 0
        } );
      }
    }

    if ( lists.length === 0 ) {
      return;
    }

    renderSplines(
      lists,
      {
        curve: {
          method: "chaikin",
          closed: false,
          iterations
        },
        stroke: {
          weight,
          glow,
          hueSpeed,
          hueSpread,
          gradient: true
        },
        overlay: {
          polygon: {
            show: false
          },
          points: {
            show: false
          }
        }
      }
    );
  }

  _drawGroupsTo(
    graphics, groups, alpha, drawOptions = {}
  ) {
    const {
      innerCircleSize = 50, shadowsCount = 3, vectorsStep = 0.05
    } = drawOptions;
    const context = graphics.drawingContext;
    const previousAlpha = context.globalAlpha;

    context.globalAlpha = alpha;

    const total = Math.max(
      groups.length - 1,
      1
    );

    groups.forEach( (
      group, groupIndex
    ) => {
      const index = groupIndex / total;

      if ( group.points.length >= 2 ) {
        neonLine( {
          innerCircleSize,
          shadowsCount,
          vectorsStep,
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

    context.globalAlpha = previousAlpha;
  }

  _snapshotGroups() {
    const p = getP5();

    return this.groups.map( ( group ) => ( {
      id: group.id,
      points: group.points.map( ( point ) => p.createVector(
        point.x,
        point.y
      ) )
    } ) );
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

  /** Trail length for the hands layer — gives the blade a Fruit-Ninja streak. */
  setHandTrail( amount ) {
    if ( this.layers.hands ) {
      this.layers.hands.fade = amount;
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

  /** Big centered counter near the top — an implicit score for game variants. */
  drawScore( {
    value = 0, label = "", show = true, color
  } = {} ) {
    if ( !show ) {
      return;
    }

    const p = getP5();
    const fill = color ? p.color( ...color ) : p.color( 0 );

    string.write(
      `${ value }`,
      0,
      p.height * 0.16,
      {
        size: 240,
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

    if ( label ) {
      string.write(
        label,
        0,
        p.height * 0.16 + 150,
        {
          size: 40,
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

    return this.addBall( {
      x: p.random(
        margin,
        p.width - margin
      ),
      y: p.random(
        margin,
        p.height - margin
      ),
      radius: p.random(
        sizeMin,
        sizeMax
      )
    } );
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
