import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#15131a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background:
              "radial-gradient(60% 60% at 35% 30%, #f4d6a8 0%, #e6ac73 38%, #b6a6e0 92%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 12,
              height: 24,
              background: "#2a2030",
              borderRadius: 999,
            }}
          />
          <div
            style={{
              width: 12,
              height: 24,
              background: "#2a2030",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
