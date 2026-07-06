"use client";

/**
 * Duo Mix — two photos blended into one another through a grid of tiles.
 *
 * The first image fills the whole frame as a base layer. On top, a grid of
 * tiles is a set of perfectly-registered windows into the *second* image — laid
 * out so that, at full reveal, the tiles reconstruct image B exactly over image
 * A. Each tile fades / scales / flips / slides / wipes image B in, holds, then
 * releases it again, so the frame morphs A → B → A on a seamless loop.
 *
 * The reveal order is driven by a chosen pattern (wave, checker, random,
 * radial, spiral, rows, columns) and spread across the loop by a stagger, so
 * image B washes over image A like a tide. A `mix-blend-mode` + peak-opacity
 * pair lets the two photos genuinely blend (screen / multiply / difference / …)
 * instead of one simply covering the other.
 *
 * Seamlessness: every tile is a `fromTo` that yoyos (enter → neutral → enter)
 * inside a window fully contained in [0, duration]. At t=0 and t=duration all
 * tiles rest in their hidden "enter" state, so the loop wraps without a jump.
 * Reveal order is normalised (min → 0, max → 1) so the last tile always lands
 * exactly on `duration` regardless of pattern, filling the loop. Everything is
 * seeded, so the scrubbed frame-capture stays deterministic.
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss,
  makeRandom,
  sineEase
} from "@/gsap/utils";

/** Per-tile reveal order in [0, 1] for the chosen pattern (pre-normalised). */
function tileOrder(
  pattern, row, col, rows, columns, angleRad, rand
) {
  const cx = ( columns - 1 ) / 2;
  const cy = ( rows - 1 ) / 2;
  const nx = columns > 1 ? col / ( columns - 1 ) : 0.5;
  const ny = rows > 1 ? row / ( rows - 1 ) : 0.5;

  switch ( pattern ) {
    case "checker":
      return ( row + col ) % 2;
    case "rows":
      return ny;
    case "columns":
      return nx;
    case "radial": {
      const dx = ( col - cx ) / Math.max(
        1,
        columns
      );
      const dy = ( row - cy ) / Math.max(
        1,
        rows
      );

      return Math.hypot(
        dx,
        dy
      );
    }
    case "spiral": {
      const dx = col - cx;
      const dy = row - cy;
      const angle = ( Math.atan2(
        dy,
        dx
      ) + Math.PI ) / ( 2 * Math.PI );
      const radius = Math.hypot(
        dx,
        dy
      ) / Math.max(
        1,
        Math.hypot(
          cx,
          cy
        )
      );

      return ( angle + radius ) % 1;
    }
    case "random":
      return rand;
    case "wave":
    default: {
      // Project the tile centre onto the angle direction so the reveal sweeps
      // across the frame along an arbitrary heading (diagonals included).
      const px = nx - 0.5;
      const py = ny - 0.5;

      return px * Math.cos( angleRad ) + py * Math.sin( angleRad );
    }
  }
}

/** Enter / neutral GSAP prop pairs for the tile reveal transition. */
function transitionStates(
  transition, direction, tileScale, tileRotate, perspective, radius
) {
  const round = `round ${ radius }px`;
  const enter = {
    rotation: tileRotate
  };
  const neutral = {
    rotation: 0
  };

  switch ( transition ) {
    case "scale":
      enter.scale = tileScale;
      neutral.scale = 1;
      break;
    case "flip":
      enter.transformPerspective = perspective;
      neutral.transformPerspective = perspective;

      if ( direction === "up" || direction === "down" ) {
        enter.rotationX = direction === "down" ? 90 : -90;
        neutral.rotationX = 0;
      } else {
        enter.rotationY = direction === "right" ? -90 : 90;
        neutral.rotationY = 0;
      }

      break;
    case "slide":
      if ( direction === "up" || direction === "down" ) {
        enter.yPercent = direction === "down" ? -120 : 120;
        neutral.yPercent = 0;
      } else {
        enter.xPercent = direction === "right" ? -120 : 120;
        neutral.xPercent = 0;
      }

      break;
    case "wipe": {
      const hidden = {
        up: `inset(100% 0% 0% 0% ${ round })`,
        down: `inset(0% 0% 100% 0% ${ round })`,
        left: `inset(0% 0% 0% 100% ${ round })`,
        right: `inset(0% 100% 0% 0% ${ round })`
      };

      enter.clipPath = hidden[ direction ] ?? hidden.up;
      neutral.clipPath = `inset(0% 0% 0% 0% ${ round })`;
      break;
    }
    case "fade":
    default:
      break;
  }

  return {
    enter,
    neutral
  };
}

export default function DuoMix( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const rows = Math.max(
    1,
    Math.round( sketch.grid?.rows ?? 6 )
  );
  const columns = Math.max(
    1,
    Math.round( sketch.grid?.columns ?? 5 )
  );
  const gap = sketch.gap ?? 0;
  const radius = sketch.cornerRadius ?? 0;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const swap = Boolean( sketch.swap );
  const pattern = sketch.pattern ?? "wave";
  const transition = sketch.transition ?? "scale";
  const direction = sketch.direction ?? "up";
  const blendMode = sketch.blendMode ?? "normal";
  const overlayOpacity = Math.max(
    0,
    Math.min(
      1,
      sketch.overlayOpacity ?? 1
    )
  );

  const urls = resolveImages( options );
  const baseUrl = imageAt(
    urls,
    swap ? 1 : 0
  );
  const overlayUrl = imageAt(
    urls,
    swap ? 0 : 1
  );

  const cellWidth = size.width / columns;
  const cellHeight = size.height / rows;
  const backgroundSize = fit === "contain"
    ? "contain"
    : `${ size.width }px ${ size.height }px`;

  const tiles = Array.from(
    {
      length: rows * columns
    },
    (
      _, index
    ) => ( {
      row: Math.floor( index / columns ),
      col: index % columns
    } )
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );
      const tileEls = gsap.utils.toArray( ".dm-tile" );
      const seed = Math.round( sketch.seed ?? 7 );
      const angleRad = ( ( sketch.angle ?? 135 ) * Math.PI ) / 180;
      const spread = Math.max(
        0,
        Math.min(
          0.95,
          sketch.spread ?? 0.55
        )
      );
      const tileScale = Math.max(
        0,
        Math.min(
          2,
          sketch.tileScale ?? 0
        )
      );
      const tileRotate = sketch.tileRotate ?? 0;
      const perspective = sketch.perspective ?? 1200;
      const breathing = Math.max(
        0,
        Math.min(
          0.3,
          sketch.breathing ?? 0
        )
      );

      const random = makeRandom( seed );
      const rawOrders = tileEls.map( (
        _, index
      ) => tileOrder(
        pattern,
        Math.floor( index / columns ),
        index % columns,
        rows,
        columns,
        angleRad,
        random()
      ) );

      const minOrder = Math.min( ...rawOrders );
      const maxOrder = Math.max( ...rawOrders );
      const orderSpan = maxOrder - minOrder;
      const degenerate = orderSpan <= 0;

      // With a normalised order the last tile begins at `spread · duration` and
      // its forward+back reveal (2·rise) lands exactly on `duration`.
      const effectiveSpread = degenerate ? 0 : spread;
      const rise = ( duration * ( 1 - effectiveSpread ) ) / 2;

      const {
        enter, neutral
      } = transitionStates(
        transition,
        direction,
        tileScale,
        tileRotate,
        perspective,
        radius
      );

      // "none" keeps the reveal system but holds it still: every tile rests in
      // its fully-revealed state so the second image sits statically over the
      // first (a fixed mix), with no tweens on the timeline.
      const revealMotion = transition !== "none";

      tileEls.forEach( (
        el, index
      ) => {
        if ( !revealMotion ) {
          tl.set(
            el,
            {
              ...neutral,
              opacity: overlayOpacity
            },
            0
          );

          return;
        }

        const u = degenerate ? 0 : ( rawOrders[ index ] - minOrder ) / orderSpan;
        const start = u * effectiveSpread * duration;

        // Frame-0 state: hidden in the "enter" pose. Explicitly set so that
        // before a tile's window opens (and after it closes) it reads identical
        // — the loop's start and end states line up.
        tl.set(
          el,
          {
            ...enter,
            opacity: 0
          },
          0
        );

        tl.fromTo(
          el,
          {
            ...enter,
            opacity: 0
          },
          {
            ...neutral,
            opacity: overlayOpacity,
            duration: rise,
            ease,
            yoyo: true,
            repeat: 1,
            immediateRender: false
          },
          start
        );
      } );

      // Optional whole-frame breathing zoom. The sine ease returns to its
      // starting value at progress 1, so it stays seamless.
      if ( breathing > 0 ) {
        tl.fromTo(
          ".dm-frame",
          {
            scale: 1
          },
          {
            scale: 1 + breathing,
            duration,
            ease: sineEase(
              1,
              0
            ),
            immediateRender: true
          },
          0
        );
      }
    },
    [
      rows,
      columns,
      gap,
      radius,
      pattern,
      transition,
      direction,
      overlayOpacity,
      sketch.angle,
      sketch.spread,
      sketch.tileScale,
      sketch.tileRotate,
      sketch.perspective,
      sketch.breathing,
      sketch.seed
    ]
  );

  return (
    <div
      className="dm-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden"
      } }
    >
      <div
        className="dm-frame"
        style={ {
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          isolation: "isolate",
          willChange: "transform"
        } }
      >
        { baseUrl
          ? (
            <img
              className="dm-base"
              src={ baseUrl }
              alt=""
              style={ {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: fit,
                filter
              } }
            />
          )
          : null }

        <div
          className="dm-overlay"
          style={ {
            position: "absolute",
            inset: 0,
            mixBlendMode: blendMode
          } }
        >
          { tiles.map( (
            tile, index
          ) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={ index }
              className="dm-tile"
              style={ {
                position: "absolute",
                left: tile.col * cellWidth + gap / 2,
                top: tile.row * cellHeight + gap / 2,
                width: cellWidth - gap,
                height: cellHeight - gap,
                borderRadius: radius,
                overflow: "hidden",
                boxShadow: shadow,
                backgroundImage: overlayUrl ? `url("${ overlayUrl }")` : undefined,
                backgroundRepeat: "no-repeat",
                backgroundSize,
                backgroundPosition:
                  `${ -( tile.col * cellWidth + gap / 2 ) }px ` +
                  `${ -( tile.row * cellHeight + gap / 2 ) }px`,
                filter,
                willChange: "transform, opacity, clip-path"
              } }
            />
          ) ) }
        </div>
      </div>
    </div>
  );
}
