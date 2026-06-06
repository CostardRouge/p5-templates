"use client";

/**
 * Ken Burns Frame — a single photo with a slow pan + zoom inside an editorial
 * frame, plus an optional caption. The pan/zoom is a yoyo tween (out and back),
 * so the loop returns to its start and wraps seamlessly.
 */
import {
  useTimeline,
  toCssColor,
  toGsapEase,
  resolveImages,
  imageAt,
  imageFilterCss
} from "@/gsap/utils";

const FONT_STACK =
  "'Helvetica Neue', Helvetica, Arial, system-ui, -apple-system, sans-serif";

function captionAlignment( position ) {
  const [
    vertical = "bottom",
    horizontal = "left"
  ] = String( position ?? "bottom-left" ).split( "-" );

  return {
    justifyContent: vertical === "top"
      ? "flex-start"
      : vertical === "middle" ? "center" : "flex-end",
    alignItems: horizontal === "left"
      ? "flex-start"
      : horizontal === "right" ? "flex-end" : "center",
    textAlign: horizontal
  };
}

export default function KenBurnsFrame( {
  options
} ) {
  const sketch = options?.sketch ?? {};
  const size = options?.size ?? {
    width: 1080,
    height: 1350
  };

  const urls = resolveImages( options );
  const imageUrl = imageAt(
    urls,
    Math.round( sketch.imageIndex ?? 0 )
  );

  const margin = sketch.margin ?? 64;
  const radius = sketch.cornerRadius ?? 16;
  const fit = sketch.imageFit ?? "cover";
  const background = toCssColor(
    sketch.backgroundColor,
    "#0a0a0c"
  );
  const filter = imageFilterCss( sketch.imageEffect );

  const zoom = Math.max(
    0,
    sketch.zoom ?? 0.12
  );
  const panX = sketch.panX ?? 0.06;
  const panY = sketch.panY ?? -0.04;

  const caption = sketch.caption ?? "";
  const captionPosition = sketch.captionPosition ?? "bottom-left";
  const captionColor = toCssColor(
    sketch.captionColor,
    "#ffffff"
  );
  const captionSize = sketch.captionSize ?? 36;

  const frameWidth = size.width - margin * 2;
  const frameHeight = size.height - margin * 2;
  const align = captionAlignment( captionPosition );

  useTimeline(
    ( {
      tl, options: opts
    } ) => {
      const duration = opts?.animation?.duration ?? 12;
      const ease = toGsapEase( opts?.sketch?.ease );

      tl.fromTo(
        ".kb-image",
        {
          scale: 1,
          x: 0,
          y: 0
        },
        {
          scale: 1 + zoom,
          x: panX * frameWidth,
          y: panY * frameHeight,
          duration: duration / 2,
          ease,
          yoyo: true,
          repeat: 1,
          immediateRender: true
        },
        0
      );
    },
    [
      imageUrl,
      zoom,
      panX,
      panY,
      frameWidth,
      frameHeight
    ]
  );

  return (
    <div
      className="kb-stage"
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
        className="kb-frame"
        style={ {
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: radius,
          overflow: "hidden",
          background: "#15151a"
        } }
      >
        { imageUrl
          ? (
            <img
              className="kb-image"
              src={ imageUrl }
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

        { caption
          ? (
            <div
              className="kb-caption"
              style={ {
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                padding: "6%",
                pointerEvents: "none",
                ...align
              } }
            >
              <span
                style={ {
                  color: captionColor,
                  fontFamily: FONT_STACK,
                  fontSize: captionSize,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  textShadow: "0 2px 18px rgba(0, 0, 0, 0.45)",
                  textAlign: align.textAlign
                } }
              >
                { caption }
              </span>
            </div>
          )
          : null }
      </div>
    </div>
  );
}
