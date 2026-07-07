"use client";

/**
 * Split Columns — vertical columns of photos scrolling in alternating
 * directions at staggered speeds, with an optional depth falloff (columns
 * further from the centre sit slightly smaller and dimmer). Each column track
 * holds two stacked copies and scrolls a whole number of copies per loop, so
 * playback wraps seamlessly.
 */
import {
  useTimeline,
  toCssColor,
  resolveImages,
  imageAt,
  imageFilterCss,
  boxShadowCss,
  seamlessScroll
} from "@/gsap/utils";

export default function SplitColumns( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const columns = Math.max(
    1,
    Math.min(
      10,
      Math.round( sketch.columns ?? 4 )
    )
  );
  const margin = sketch.margin ?? 0;
  const gap = sketch.gap ?? 16;
  const colGap = sketch.colGap ?? 16;
  const itemAspect = sketch.itemAspect ?? 0.75;
  const baseSpeed = Math.max(
    1,
    Math.round( sketch.baseSpeed ?? 1 )
  );
  const speedStep = Math.max(
    0,
    Math.round( sketch.speedStep ?? 0 )
  );
  const alternate = sketch.alternate ?? true;
  const reverseAll = sketch.reverseAll ?? false;
  const parallax = Math.max(
    0,
    Math.min(
      0.6,
      sketch.parallax ?? 0.12
    )
  );

  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const urls = resolveImages( options );

  const usableWidth = size.width - margin * 2 - colGap * ( columns - 1 );
  const colWidth = Math.max(
    1,
    usableWidth / columns
  );
  const itemHeight = colWidth / itemAspect;
  const itemsPerSet = Math.max(
    2,
    Math.ceil( size.height / ( itemHeight + gap ) ) + 1
  );
  const setHeight = itemsPerSet * ( itemHeight + gap );

  const center = ( columns - 1 ) / 2;
  const maxDistance = Math.max(
    1,
    center
  );

  const colConfigs = Array.from(
    {
      length: columns
    },
    (
      _, c
    ) => {
      const items = Array.from(
        {
          length: itemsPerSet * 2
        },
        (
          __, i
        ) => imageAt(
          urls,
          c * 5 + i
        )
      );
      const reverse = reverseAll !== ( alternate && c % 2 === 1 );
      const distanceFromCenter = Math.abs( c - center ) / maxDistance;
      const scale = 1 - parallax * distanceFromCenter;
      const shade = parallax * distanceFromCenter * 0.9;

      return {
        items,
        reverse,
        cycles: baseSpeed + c * speedStep,
        scale,
        shade
      };
    }
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const tracks = gsap.utils.toArray( ".sc-track" );

      tracks.forEach( (
        track, c
      ) => {
        seamlessScroll(
          tl,
          track,
          {
            axis: "y",
            distance: Number( track.dataset.loopDistance ),
            cycles: colConfigs[ c ]?.cycles ?? baseSpeed,
            reverse: colConfigs[ c ]?.reverse ?? false,
            duration
          }
        );
      } );
    },
    [
      columns,
      itemsPerSet,
      setHeight,
      baseSpeed,
      speedStep,
      alternate,
      reverseAll,
      itemAspect,
      parallax
    ]
  );

  return (
    <div
      className="sc-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden",
        boxSizing: "border-box",
        padding: margin,
        display: "flex",
        flexDirection: "row",
        gap: colGap
      } }
    >
      { colConfigs.map( (
        col, c
      ) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={ c }
          className="sc-col"
          style={ {
            position: "relative",
            flex: "1 1 0",
            height: "100%",
            overflow: "hidden",
            transform: `scale(${ col.scale })`,
            transformOrigin: "center center"
          } }
        >
          <div
            className="sc-track"
            data-loop-distance={ setHeight }
            style={ {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap,
              willChange: "transform"
            } }
          >
            { col.items.map( (
              url, i
            ) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={ i }
                className="sc-item"
                style={ {
                  position: "relative",
                  flex: "0 0 auto",
                  width: "100%",
                  height: itemHeight,
                  borderRadius: radius,
                  overflow: "hidden",
                  background: "#15151a",
                  boxShadow: shadow
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
          <div
            className="sc-shade"
            style={ {
              position: "absolute",
              inset: 0,
              background: "#000",
              opacity: col.shade,
              pointerEvents: "none"
            } }
          />
        </div>
      ) ) }
    </div>
  );
}
