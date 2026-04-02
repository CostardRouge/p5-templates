import {
  ImageResponse
} from "next/og";
import {
  SITE_DESCRIPTION, SITE_NAME
} from "@/lib/seo";

export const runtime = "edge";

export const alt = SITE_NAME;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Decorative circles inspired by the app icon */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          marginBottom: "48px",
        }}
      >
        {[
          "#f7941d",
          "#ed5a4b",
          "#e8558e",
          "#f5c525",
          "#2da77a",
          "#42c5d9",
          "#4cbcac",
          "#2a6fb5",
          "#5e548e",
        ].map( ( color ) => (
          <div
            key={color}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: color,
            }}
          />
        ) )}
      </div>

      <div
        style={{
          fontSize: "64px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginBottom: "16px",
        }}
      >
        {SITE_NAME}
      </div>

      <div
        style={{
          fontSize: "24px",
          color: "#999",
          maxWidth: "800px",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {SITE_DESCRIPTION}
      </div>
    </div>,
    {
      ...size,
    }
  );
}
