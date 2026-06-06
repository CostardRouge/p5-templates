"use client";

/**
 * Orbit Ring — photos placed around a circle that orbits its centre. The ring
 * spins (rotateZ) while each card optionally counter-rotates to stay upright
 * (billboard), so the photos travel around the circle without tumbling. An
 * optional tilt + perspective turns the circle into a 3D ellipse.
 *
 * The ring spins a whole number of turns per loop, so playback wraps
 * seamlessly — one linear tween on the ring (and one per card) keeps the
 * scrubbed, frame-stepped capture deterministic.
 */
import {
  useTimeline,
  toCssColor,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss
} from "@/gsap/utils";

export default function OrbitRing( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const count = Math.max(
    2,
    Math.min(
      24,
      Math.round( sketch.count ?? 8 )
    )
  );
  const ringRadiusRatio = sketch.ringRadiusRatio ?? 0.62;
  const cardWidthRatio = sketch.cardWidthRatio ?? 0.22;
  const cardAspect = sketch.cardAspect ?? 1.2;
  const tilt = sketch.tilt ?? 0;
  const perspective = sketch.perspective ?? 1600;
  const upright = sketch.upright ?? true;
  const spins = Math.max(
    1,
    Math.round( sketch.spins ?? 1 )
  );
  const direction = sketch.direction ?? "cw";

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
  const ringRadius = ( minDim / 2 ) * ringRadiusRatio;
  const cardWidth = minDim * cardWidthRatio;
  const cardHeight = cardWidth * cardAspect;

  const imageUrls = resolveImages( options );
  const slots = Array.from(
    {
      length: count
    },
    (
      _, index
    ) => {
      const theta = ( index / count ) * Math.PI * 2;

      return {
        url: imageAt(
          imageUrls,
          index
        ),
        x: Math.cos( theta ) * ringRadius - cardWidth / 2,
        y: Math.sin( theta ) * ringRadius - cardHeight / 2
      };
    }
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const sign = direction === "ccw" ? -1 : 1;
      const turn = sign * 360 * spins;

      tl.to(
        ".or-ring",
        {
          rotation: turn,
          duration,
          ease: "none"
        },
        0
      );

      if ( upright ) {
        tl.to(
          ".or-card",
          {
            rotation: -turn,
            duration,
            ease: "none"
          },
          0
        );
      }
    },
    [
      count,
      ringRadiusRatio,
      cardWidthRatio,
      cardAspect,
      tilt,
      perspective,
      upright,
      spins,
      direction
    ]
  );

  return (
    <div
      className="or-stage"
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
        className="or-tilt"
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
          className="or-ring"
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
          { slots.map( (
            slot, index
          ) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={ index }
              className="or-slot"
              style={ {
                position: "absolute",
                left: slot.x,
                top: slot.y,
                width: cardWidth,
                height: cardHeight
              } }
            >
              <div
                className="or-card"
                style={ {
                  position: "absolute",
                  inset: 0,
                  borderRadius: radius,
                  overflow: "hidden",
                  background: "#15151a",
                  boxShadow: shadow,
                  willChange: "transform"
                } }
              >
                { slot.url
                  ? (
                    <img
                      src={ slot.url }
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
            </div>
          ) ) }
        </div>
      </div>
    </div>
  );
}
