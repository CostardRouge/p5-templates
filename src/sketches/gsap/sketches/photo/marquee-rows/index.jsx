"use client";

/**
 * Marquee Rows — several rows of photos scrolling horizontally in a continuous
 * loop, with alternating directions and per-row speeds. Each row's track holds
 * two back-to-back copies of its content and scrolls a whole number of copies
 * per loop, so playback wraps seamlessly.
 *
 * Speed/direction live in the timeline as repeating linear tweens (no
 * `onUpdate`), keeping the scrubbed, frame-stepped capture deterministic.
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

export default function MarqueeRows( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const rows = Math.max(
    1,
    Math.min(
      10,
      Math.round( sketch.rows ?? 4 )
    )
  );
  const margin = sketch.margin ?? 0;
  const gap = sketch.gap ?? 16;
  const rowGap = sketch.rowGap ?? 16;
  const itemAspect = sketch.itemAspect ?? 1.4;
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

  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );
  const shadow = boxShadowCss( sketch.shadow );

  const urls = resolveImages( options );

  const usableHeight = size.height - margin * 2 - rowGap * ( rows - 1 );
  const rowHeight = Math.max(
    1,
    usableHeight / rows
  );
  const itemWidth = rowHeight * itemAspect;
  const itemsPerSet = Math.max(
    2,
    Math.ceil( size.width / ( itemWidth + gap ) ) + 1
  );
  const setWidth = itemsPerSet * ( itemWidth + gap );

  const rowConfigs = Array.from(
    {
      length: rows
    },
    (
      _, r
    ) => {
      const items = Array.from(
        {
          length: itemsPerSet * 2
        },
        (
          __, i
        ) => imageAt(
          urls,
          r * 7 + i
        )
      );
      const reverse = reverseAll !== ( alternate && r % 2 === 1 );

      return {
        items,
        reverse,
        cycles: baseSpeed + r * speedStep
      };
    }
  );

  useTimeline(
    ( {
      tl, gsap, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const tracks = gsap.utils.toArray( ".mr-track" );

      tracks.forEach( (
        track, r
      ) => {
        seamlessScroll(
          tl,
          track,
          {
            axis: "x",
            distance: Number( track.dataset.loopDistance ),
            cycles: rowConfigs[ r ]?.cycles ?? baseSpeed,
            reverse: rowConfigs[ r ]?.reverse ?? false,
            duration
          }
        );
      } );
    },
    [
      rows,
      itemsPerSet,
      setWidth,
      baseSpeed,
      speedStep,
      alternate,
      reverseAll,
      itemAspect
    ]
  );

  return (
    <div
      className="mr-stage"
      style={ {
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        overflow: "hidden",
        boxSizing: "border-box",
        padding: margin,
        display: "flex",
        flexDirection: "column",
        gap: rowGap
      } }
    >
      { rowConfigs.map( (
        row, r
      ) => (
        <div
          key={ r }
          className="mr-row"
          style={ {
            position: "relative",
            height: rowHeight,
            overflow: "hidden"
          } }
        >
          <div
            className="mr-track"
            data-loop-distance={ setWidth }
            style={ {
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              display: "flex",
              gap,
              willChange: "transform"
            } }
          >
            { row.items.map( (
              url, i
            ) => (
              <div
                key={ i }
                className="mr-item"
                style={ {
                  position: "relative",
                  flex: "0 0 auto",
                  width: itemWidth,
                  height: "100%",
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
        </div>
      ) ) }
    </div>
  );
}
