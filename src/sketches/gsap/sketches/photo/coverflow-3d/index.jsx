"use client";

/**
 * Coverflow 3D — photos arranged around a vertical 3D ring (a cylinder
 * carousel). With perspective the front card reads large and flat while the
 * side cards angle away, giving the classic coverflow feel. The ring spins
 * a whole number of turns per loop, so playback wraps seamlessly.
 *
 * Two spin modes:
 *   • continuous — constant rotation (linear), endlessly flowing.
 *   • stepped    — eased card-by-card snaps.
 *
 * Everything is one (or a sequence of) real `rotationY` tween(s) on the ring,
 * so the scrubbed, frame-stepped capture stays deterministic.
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

export default function Coverflow3d( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const count = Math.max(
    3,
    Math.min(
      20,
      Math.round( sketch.count ?? 7 )
    )
  );
  const cardWidthRatio = sketch.cardWidthRatio ?? 0.42;
  const cardAspect = sketch.cardAspect ?? 1.35;
  const radiusFactor = sketch.radiusFactor ?? 1;
  const perspective = sketch.perspective ?? 1600;
  const tilt = sketch.tilt ?? 0;
  const gap = sketch.gap ?? 16;
  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";

  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const minDim = Math.min(
    size.width,
    size.height
  );
  const cardWidth = minDim * cardWidthRatio;
  const cardHeight = cardWidth * cardAspect;
  const step = 360 / count;
  const ringRadius =
    ( ( cardWidth + gap ) / ( 2 * Math.tan( Math.PI / count ) ) ) * radiusFactor;

  const urls = resolveImages( options );
  const cards = Array.from(
    {
      length: count
    },
    (
      _, index
    ) => imageAt(
      urls,
      index
    )
  );

  const spinMode = sketch.spinMode ?? "continuous";
  const spins = Math.max(
    1,
    Math.round( sketch.spins ?? 1 )
  );
  const direction = sketch.direction ?? "left";

  useTimeline(
    ( {
      tl, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );
      const sign = direction === "right" ? 1 : -1;

      if ( spinMode === "stepped" ) {
        const steps = count * spins;
        const stepDuration = duration / steps;

        for ( let i = 0; i < steps; i++ ) {
          tl.to(
            ".cf-ring",
            {
              rotationY: sign * step * ( i + 1 ),
              duration: stepDuration,
              ease
            },
            i * stepDuration
          );
        }
      } else {
        tl.to(
          ".cf-ring",
          {
            rotationY: sign * 360 * spins,
            duration,
            ease: "none"
          },
          0
        );
      }
    },
    [
      count,
      cardWidthRatio,
      cardAspect,
      radiusFactor,
      perspective,
      tilt,
      gap,
      spinMode,
      spins,
      direction
    ]
  );

  return (
    <div
      className="cf-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden",
        perspective: `${ perspective }px`,
        perspectiveOrigin: "50% 50%"
      } }
    >
      <div
        className="cf-tilt"
        style={ {
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transformStyle: "preserve-3d",
          transform: `rotateX(${ tilt }deg)`
        } }
      >
        <div
          className="cf-ring"
          style={ {
            position: "absolute",
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
            willChange: "transform"
          } }
        >
          { cards.map( (
            url, index
          ) => (
            <div
              key={ index }
              className="cf-card"
              style={ {
                position: "absolute",
                width: cardWidth,
                height: cardHeight,
                left: -cardWidth / 2,
                top: -cardHeight / 2,
                borderRadius: radius,
                overflow: "hidden",
                background: "#15151a",
                boxShadow: shadow,
                transform: `rotateY(${ index * step }deg) translateZ(${ ringRadius }px)`
              } }
            >
              { url
                ? (
                  <img
                    src={ url }
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
            </div>
          ) ) }
        </div>
      </div>
    </div>
  );
}
