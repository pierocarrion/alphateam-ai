import { ImageResponse } from "next/og";

export const alt = "AlphaLead AI — Stop team procrastination before it spreads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background:
            "radial-gradient(120% 120% at 20% 10%, #2a2533 0%, #15131A 55%, #0c0b10 100%)",
          color: "#f4d6a8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background:
                "radial-gradient(60% 60% at 35% 30%, #f4d6a8 0%, #E6AC73 38%, #B6A6E0 92%)",
              boxShadow: "0 0 38px -4px rgba(230,172,115,0.5)",
            }}
          />
          <span style={{ fontSize: 36, fontWeight: 700, color: "#f4d6a8" }}>
            AlphaLead AI
          </span>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            color: "#fff",
            maxWidth: 960,
            letterSpacing: "-0.02em",
          }}
        >
          Stop team procrastination before it spreads.
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 28,
            color: "#b8b2c4",
            maxWidth: 880,
            lineHeight: 1.4,
          }}
        >
          Alpha detects tasks in team chat and shrinks them into 2-minute
          starts — without shame.
        </div>
      </div>
    ),
    { ...size }
  );
}
