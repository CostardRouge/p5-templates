import fs from "fs";
import path from "path";
import {
  ImageResponse
} from "next/og";
import {
  SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE
} from "@/lib/seo";

// Read the project icon from disk and embed it as a data URL so the OG card
// always shows the real project mark, even when generated offline.
export const runtime = "nodejs";

export const alt = `${ SITE_NAME } — ${ SITE_TAGLINE }`;
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

const ICON_DATA_URL = ( () => {
  const filePath = path.join(
    process.cwd(),
    "public",
    "assets",
    "images",
    "icon-512x512.png"
  );
  const buf = fs.readFileSync( filePath );

  return `data:image/png;base64,${ buf.toString( "base64" ) }`;
} )();

export default async function Image() {
  return new ImageResponse(
    <div
      style={ {
        height: "100%",
        width: "100%",
        display: "flex",
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        padding: "72px 80px",
        position: "relative"
      } }
    >
      {/* Subtle dot-grid backdrop reminiscent of the home page */}
      <div
        style={ {
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          display: "flex"
        } }
      />
      {/* Soft fuchsia glow in the corner */}
      <div
        style={ {
          position: "absolute",
          top: "-180px",
          right: "-160px",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(236,72,153,0.35), transparent 70%)",
          display: "flex"
        } }
      />

      {/* Top metadata bar */}
      <div
        style={ {
          position: "absolute",
          top: "48px",
          left: "80px",
          right: "80px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          fontSize: "20px",
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          fontFamily: "system-ui, sans-serif"
        } }
      >
        <span>v.0.1</span>
        <span
          style={ {
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#ec4899",
            display: "flex"
          } }
        />
        <span>{SITE_NAME}</span>
        <span
          style={ {
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.3)",
            display: "flex"
          } }
        />
        <span>browser-native</span>
      </div>

      {/* Main split: icon on the left, text on the right */}
      <div
        style={ {
          display: "flex",
          alignItems: "center",
          gap: "72px",
          width: "100%",
          position: "relative"
        } }
      >
        <div
          style={ {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "440px",
            height: "440px",
            flexShrink: 0
          } }
        >
          { }
          <img
            src={ ICON_DATA_URL }
            alt=""
            width={ 440 }
            height={ 440 }
            style={ {
              width: "440px",
              height: "440px",
              objectFit: "contain"
            } }
          />
        </div>

        <div
          style={ {
            display: "flex",
            flexDirection: "column",
            gap: "28px",
            flex: 1
          } }
        >
          <div
            style={ {
              fontSize: "104px",
              fontWeight: 900,
              lineHeight: 0.92,
              letterSpacing: "-0.045em",
              display: "flex",
              flexDirection: "column",
              color: "#fff"
            } }
          >
            <span style={ {
              display: "flex"
            } }>a studio</span>
            <span style={ {
              display: "flex",
              gap: "20px"
            } }>
              <span>for</span>
              <span style={ {
                fontWeight: 200,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.85)"
              } }
              >
                social
              </span>
            </span>
            <span style={ {
              display: "flex"
            } }>
              <span>visuals</span>
              <span style={ {
                color: "#ec4899"
              } }>.</span>
            </span>
          </div>

          <div
            style={ {
              fontSize: "22px",
              color: "rgba(255,255,255,0.62)",
              lineHeight: 1.45,
              maxWidth: "560px",
              display: "flex"
            } }
          >
            {SITE_DESCRIPTION}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size
    }
  );
}
