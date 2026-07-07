"use client";

/**
 * Duo Swap — two photos placed side by side, split down the middle, with a set
 * of tiles at mid-frame whose content is *swapped* between the two images.
 *
 * The frame is divided by a movable seam: one side shows image A, the other
 * image B. Both images are laid out as a full-frame `cover`, so a pixel at (x, y)
 * belongs to the same spot in either photo. A grid of "swap tiles" then sits
 * over the seam: a tile on image A's side is a window into image B (in perfect
 * register), and a tile on image B's side is a window into image A — so each
 * tile shows the opposite photo exactly where it would be, weaving the two
 * pictures into one another.
 *
 * The tiles reveal / hold / release the swapped content on a seamless loop using
 * the shared reveal system (fade / scale / flip / slide / wipe, or a static
 * "none" mode that simply holds the swap in place). Every tile is a `fromTo`
 * that yoyos inside a window contained in [0, duration], the reveal order is
 * normalised so the last tile lands exactly on `duration`, and all randomness
 * is seeded — so the loop wraps seamlessly and stays deterministic under
 * frame-stepped capture.
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
      // across the band along an arbitrary heading (diagonals included).
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

export default function DuoSwap( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const columns = Math.max(
    1,
    Math.round( sketch.columns ?? 2 )
  );
  const rows = Math.max(
    1,
    Math.round( sketch.rows ?? 1 )
  );
  const gap = sketch.gap ?? 8;
  const radius = sketch.cornerRadius ?? 0;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const swap = Boolean( sketch.swap );
  const splitAxis = sketch.splitAxis ?? "vertical";
  const splitRatio = Math.max(
    0.05,
    Math.min(
      0.95,
      sketch.splitRatio ?? 0.5
    )
  );
  const dividerWidth = Math.max(
    0,
    sketch.dividerWidth ?? 0
  );
  const dividerColor = toCssColor(
    sketch.dividerColor,
    "#ffffff"
  );

  const tileSize = Math.max(
    0.02,
    Math.min(
      0.9,
      sketch.tileSize ?? 0.3
    )
  );
  const centerX = Math.max(
    0,
    Math.min(
      1,
      sketch.centerX ?? 0.5
    )
  );
  const centerY = Math.max(
    0,
    Math.min(
      1,
      sketch.centerY ?? 0.5
    )
  );

  const blendMode = sketch.blendMode ?? "normal";
  const overlayOpacity = Math.max(
    0,
    Math.min(
      1,
      sketch.overlayOpacity ?? 1
    )
  );

  const urls = resolveImages( options );
  const imageA = imageAt(
    urls,
    swap ? 1 : 0
  );
  const imageB = imageAt(
    urls,
    swap ? 0 : 1
  );

  const isVertical = splitAxis === "vertical";
  const backgroundSize = fit === "contain"
    ? "contain"
    : `${ size.width }px ${ size.height }px`;

  // Seam clip for each base panel (a full-frame image clipped to its half).
  const panelAClip = isVertical
    ? `inset(0% ${ ( 1 - splitRatio ) * 100 }% 0% 0%)`
    : `inset(0% 0% ${ ( 1 - splitRatio ) * 100 }% 0%)`;
  const panelBClip = isVertical
    ? `inset(0% 0% 0% ${ splitRatio * 100 }%)`
    : `inset(${ splitRatio * 100 }% 0% 0% 0%)`;

  // Swap-tile grid geometry, centred on (centerX, centerY).
  const minDim = Math.min(
    size.width,
    size.height
  );
  const tilePx = tileSize * minDim;
  const gridWidth = columns * tilePx + ( columns - 1 ) * gap;
  const gridHeight = rows * tilePx + ( rows - 1 ) * gap;
  const originX = centerX * size.width - gridWidth / 2;
  const originY = centerY * size.height - gridHeight / 2;
  const seamX = splitRatio * size.width;
  const seamY = splitRatio * size.height;

  const tiles = Array.from(
    {
      length: rows * columns
    },
    (
      _, index
    ) => {
      const row = Math.floor( index / columns );
      const col = index % columns;
      const left = originX + col * ( tilePx + gap );
      const top = originY + row * ( tilePx + gap );
      const tileCenterX = left + tilePx / 2;
      const tileCenterY = top + tilePx / 2;
      // A tile sitting over panel A shows image B, and vice-versa — the swap.
      const overPanelA = isVertical
        ? tileCenterX < seamX
        : tileCenterY < seamY;

      return {
        row,
        col,
        left,
        top,
        image: overPanelA ? imageB : imageA
      };
    }
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );
      const tileEls = gsap.utils.toArray( ".ds-tile" );
      const transition = opts?.sketch?.transition ?? "scale";
      const direction = opts?.sketch?.direction ?? "up";
      const pattern = opts?.sketch?.pattern ?? "wave";
      const seed = Math.round( opts?.sketch?.seed ?? 7 );
      const angleRad = ( ( opts?.sketch?.angle ?? 135 ) * Math.PI ) / 180;
      const spread = Math.max(
        0,
        Math.min(
          0.95,
          opts?.sketch?.spread ?? 0.55
        )
      );
      const tileScale = Math.max(
        0,
        Math.min(
          2,
          opts?.sketch?.tileScale ?? 0
        )
      );
      const tileRotate = opts?.sketch?.tileRotate ?? 0;
      const perspective = opts?.sketch?.perspective ?? 1200;
      const breathing = Math.max(
        0,
        Math.min(
          0.3,
          opts?.sketch?.breathing ?? 0
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
      // its fully-swapped state so the opposite image sits statically over the
      // seam (a fixed swap), with no tweens on the timeline.
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
          ".ds-frame",
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
      radius
    ]
  );

  return (
    <div
      className="ds-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden"
      } }
    >
      <div
        className="ds-frame"
        style={ {
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          isolation: "isolate",
          willChange: "transform"
        } }
      >
        { imageA
          ? (
            <img
              className="ds-panel-a"
              src={ imageA }
              alt=""
              style={ {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: fit,
                filter,
                clipPath: panelAClip
              } }
            />
          )
          : null }

        { imageB
          ? (
            <img
              className="ds-panel-b"
              src={ imageB }
              alt=""
              style={ {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: fit,
                filter,
                clipPath: panelBClip
              } }
            />
          )
          : null }

        { dividerWidth > 0
          ? (
            <div
              className="ds-divider"
              style={ {
                position: "absolute",
                background: dividerColor,
                ...( isVertical
                  ? {
                    top: 0,
                    bottom: 0,
                    left: seamX,
                    width: dividerWidth,
                    transform: "translateX(-50%)"
                  }
                  : {
                    left: 0,
                    right: 0,
                    top: seamY,
                    height: dividerWidth,
                    transform: "translateY(-50%)"
                  } )
              } }
            />
          )
          : null }

        <div
          className="ds-overlay"
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
              className="ds-tile"
              style={ {
                position: "absolute",
                left: tile.left,
                top: tile.top,
                width: tilePx,
                height: tilePx,
                borderRadius: radius,
                overflow: "hidden",
                boxShadow: shadow,
                backgroundImage: tile.image ? `url("${ tile.image }")` : undefined,
                backgroundRepeat: "no-repeat",
                backgroundSize,
                backgroundPosition: `${ -tile.left }px ${ -tile.top }px`,
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
