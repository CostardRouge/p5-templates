"use client";

/**
 * Grid Cascade — a rows × columns photo grid that reveals in a configurable
 * cascade (origin + style), holds, then clears in reverse so the loop is
 * seamless. A subtle continuous "breathing" zoom keeps the held frame alive.
 *
 * The whole reveal/hold/exit cycle fills `options.animation.duration` and the
 * end state equals the start state (cells hidden), so it wraps cleanly. All
 * motion is expressed as real tweens (no `onUpdate`), keeping the scrubbed,
 * frame-stepped capture deterministic.
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss
} from "@/gsap/utils";

/** Directional clip-path insets (with rounded corners preserved). */
function clipFor(
  direction, radius
) {
  const round = `round ${ radius }px`;
  const hiddenByDirection = {
    up: `inset(100% 0% 0% 0% ${ round })`,
    down: `inset(0% 0% 100% 0% ${ round })`,
    left: `inset(0% 0% 0% 100% ${ round })`,
    right: `inset(0% 100% 0% 0% ${ round })`
  };

  return {
    hidden: hiddenByDirection[ direction ] ?? hiddenByDirection.up,
    shown: `inset(0% 0% 0% 0% ${ round })`
  };
}

/** Hidden / shown GSAP prop pairs for each reveal style. */
function revealStates(
  style, direction, radius
) {
  switch ( style ) {
    case "fade":
      return {
        hidden: {
          opacity: 0
        },
        shown: {
          opacity: 1
        }
      };
    case "scale":
      return {
        hidden: {
          opacity: 0,
          scale: 0.6
        },
        shown: {
          opacity: 1,
          scale: 1
        }
      };
    case "rise": {
      const sign = direction === "down" ? -1 : 1;
      const axis = direction === "left" || direction === "right"
        ? "xPercent"
        : "yPercent";
      const dirSign = direction === "left" ? -1 : direction === "right" ? 1 : sign;

      return {
        hidden: {
          opacity: 0,
          [ axis ]: 70 * dirSign
        },
        shown: {
          opacity: 1,
          [ axis ]: 0
        }
      };
    }
    case "flip": {
      const flipAxis = direction === "up" || direction === "down"
        ? "rotationX"
        : "rotationY";
      const sign = direction === "down" || direction === "right" ? -1 : 1;

      return {
        hidden: {
          opacity: 0,
          transformPerspective: 1200,
          transformOrigin: "center center",
          [ flipAxis ]: 90 * sign
        },
        shown: {
          opacity: 1,
          [ flipAxis ]: 0
        }
      };
    }
    case "clip":
    default: {
      const clip = clipFor(
        direction,
        radius
      );

      return {
        hidden: {
          opacity: 1,
          clipPath: clip.hidden
        },
        shown: {
          opacity: 1,
          clipPath: clip.shown
        }
      };
    }
  }
}

/** GSAP stagger config for a given cascade origin. */
function staggerFor(
  origin, rows, columns, amount
) {
  const base = {
    amount,
    grid: [
      rows,
      columns
    ]
  };

  switch ( origin ) {
    case "center":
      return {
        ...base,
        from: "center"
      };
    case "edges":
      return {
        ...base,
        from: "edges"
      };
    case "random":
      return {
        ...base,
        from: "random"
      };
    case "rows":
      return {
        ...base,
        from: "start",
        axis: "y"
      };
    case "columns":
      return {
        ...base,
        from: "start",
        axis: "x"
      };
    case "diagonal":
    default:
      return {
        ...base,
        from: 0
      };
  }
}

export default function GridCascade( {
  options
} ) {
  const sketch = options?.sketch ?? {};

  const rows = Math.max(
    1,
    Math.round( sketch.grid?.rows ?? 3 )
  );
  const columns = Math.max(
    1,
    Math.round( sketch.grid?.columns ?? 3 )
  );
  const margin = sketch.margin ?? 64;
  const gap = sketch.gap ?? 16;
  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const urls = resolveImages( options );
  const cellCount = rows * columns;
  const cells = Array.from(
    {
      length: cellCount
    },
    (
      _, index
    ) => imageAt(
      urls,
      index
    )
  );

  const style = sketch.revealStyle ?? "clip";
  const direction = sketch.revealDirection ?? "up";
  const origin = sketch.staggerOrigin ?? "diagonal";
  const breathing = sketch.breathing ?? 0.04;

  useTimeline(
    ( {
      tl, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );

      const revealFraction = Math.min(
        0.8,
        Math.max(
          0.1,
          opts?.sketch?.timing?.revealFraction ?? 0.4
        )
      );
      const holdFraction = Math.min(
        0.8,
        Math.max(
          0,
          opts?.sketch?.timing?.holdFraction ?? 0.2
        )
      );

      const revealSpan = duration * revealFraction;
      const holdSpan = duration * holdFraction;
      const exitSpan = Math.max(
        0.001,
        duration - revealSpan - holdSpan
      );

      const {
        hidden, shown
      } = revealStates(
        style,
        direction,
        radius
      );

      const revealStaggerAmount = revealSpan * 0.6;
      const revealCellDur = Math.max(
        0.05,
        revealSpan - revealStaggerAmount
      );

      const exitStart = revealSpan + holdSpan;
      const exitStaggerAmount = exitSpan * 0.6;
      const exitCellDur = Math.max(
        0.05,
        exitSpan - exitStaggerAmount
      );

      tl.set(
        ".gc-cell",
        hidden
      );

      tl.to(
        ".gc-cell",
        {
          ...shown,
          duration: revealCellDur,
          ease,
          stagger: staggerFor(
            origin,
            rows,
            columns,
            revealStaggerAmount
          )
        },
        0
      );

      tl.to(
        ".gc-cell",
        {
          ...hidden,
          duration: exitCellDur,
          ease,
          stagger: staggerFor(
            origin,
            rows,
            columns,
            exitStaggerAmount
          )
        },
        exitStart
      );

      if ( breathing > 0 ) {
        tl.to(
          ".gc-img",
          {
            scale: 1 + breathing,
            duration: duration / 2,
            ease: "sine.inOut",
            yoyo: true,
            repeat: 1
          },
          0
        );
      }
    },
    [
      rows,
      columns,
      style,
      direction,
      origin,
      radius,
      breathing
    ]
  );

  return (
    <div
      className="gc-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        boxSizing: "border-box",
        padding: margin,
        overflow: "hidden"
      } }
    >
      <div
        className="gc-grid"
        style={ {
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: `repeat(${ columns }, 1fr)`,
          gridTemplateRows: `repeat(${ rows }, 1fr)`,
          gap
        } }
      >
        { cells.map( (
          url, index
        ) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={ index }
            className="gc-cell"
            style={ {
              position: "relative",
              overflow: "hidden",
              borderRadius: radius,
              boxShadow: shadow,
              background: "#15151a",
              willChange: "transform, opacity, clip-path"
            } }
          >
            { url
              ? (
                <img
                  className="gc-img"
                  src={ url }
                  alt=""
                  style={ {
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: fit,
                    filter,
                    willChange: "transform"
                  } }
                />
              )
              : null }
          </div>
        ) ) }
      </div>
    </div>
  );
}
