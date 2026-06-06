"use client";

/**
 * Stack Peel — a deck where the front card peels up and over from its top edge
 * (a Polaroid-style flick), then drops to the back while the rest shift forward
 * a slot. The deck is a pure rotation: at step `k`, card `i` sits in slot
 * `(i - k) mod N`, so after N steps the original order is restored and the loop
 * wraps seamlessly. All motion is explicit tweens.
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

export default function StackPeel( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const urls = resolveImages( options );
  const maxCards = Math.max(
    2,
    Math.min(
      12,
      Math.round( sketch.maxCards ?? 5 )
    )
  );
  const count = urls.length
    ? Math.max(
      2,
      Math.min(
        maxCards,
        urls.length
      )
    )
    : maxCards;

  const cardWidthRatio = sketch.cardWidthRatio ?? 0.6;
  const cardAspect = sketch.cardAspect ?? 1.3;
  const offsetY = sketch.offsetY ?? 22;
  const scaleStep = sketch.scaleStep ?? 0.04;
  const depthStep = sketch.depthStep ?? 60;
  const dimStep = sketch.dimStep ?? 0.08;
  const peelAngle = sketch.peelAngle ?? 160;
  const perspective = sketch.perspective ?? 1600;

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

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );

      const slot = ( s ) => ( {
        y: s * offsetY,
        rotationX: 0,
        scale: 1 - s * scaleStep,
        z: -s * depthStep
      } );
      const shade = ( s ) => Math.min(
        0.65,
        s * dimStep
      );

      const cardEls = gsap.utils.toArray( ".sp-card" );
      const shadeEls = gsap.utils.toArray( ".sp-shade" );

      if ( !cardEls.length ) {
        return;
      }

      cardEls.forEach( (
        el, i
      ) => {
        tl.set(
          el,
          slot( i ),
          0
        );
        tl.set(
          shadeEls[ i ],
          {
            opacity: shade( i )
          },
          0
        );
      } );

      const n = cardEls.length;
      const stepDuration = duration / n;

      for ( let k = 0; k < n; k++ ) {
        const start = k * stepDuration;

        for ( let i = 0; i < n; i++ ) {
          const startSlot = ( ( i - k ) % n + n ) % n;
          const card = cardEls[ i ];
          const sh = shadeEls[ i ];

          if ( startSlot === 0 ) {
            tl.to(
              card,
              {
                rotationX: -peelAngle,
                z: depthStep,
                duration: stepDuration * 0.5,
                ease
              },
              start
            );
            tl.to(
              sh,
              {
                opacity: 0,
                duration: stepDuration * 0.5,
                ease
              },
              start
            );
            tl.to(
              card,
              {
                ...slot( n - 1 ),
                duration: stepDuration * 0.5,
                ease
              },
              start + stepDuration * 0.5
            );
            tl.to(
              sh,
              {
                opacity: shade( n - 1 ),
                duration: stepDuration * 0.5,
                ease
              },
              start + stepDuration * 0.5
            );
          } else {
            const endSlot = startSlot - 1;

            tl.to(
              card,
              {
                ...slot( endSlot ),
                duration: stepDuration,
                ease
              },
              start
            );
            tl.to(
              sh,
              {
                opacity: shade( endSlot ),
                duration: stepDuration,
                ease
              },
              start
            );
          }
        }
      }
    },
    [
      count,
      cardWidthRatio,
      cardAspect,
      offsetY,
      scaleStep,
      depthStep,
      dimStep,
      peelAngle,
      perspective
    ]
  );

  return (
    <div
      className="sp-stage"
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
        className="sp-deck"
        style={ {
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transformStyle: "preserve-3d"
        } }
      >
        { cards.map( (
          url, index
        ) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={ index }
            className="sp-card"
            style={ {
              position: "absolute",
              width: cardWidth,
              height: cardHeight,
              left: -cardWidth / 2,
              top: -cardHeight / 2,
              transformOrigin: "50% 0%",
              borderRadius: radius,
              overflow: "hidden",
              background: "#15151a",
              boxShadow: shadow,
              willChange: "transform"
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
            <div
              className="sp-shade"
              style={ {
                position: "absolute",
                inset: 0,
                background: "#000",
                opacity: 0,
                pointerEvents: "none"
              } }
            />
          </div>
        ) ) }
      </div>
    </div>
  );
}
