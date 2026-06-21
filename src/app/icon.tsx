import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background:
              "radial-gradient(60% 60% at 35% 30%, #f4d6a8 0%, #e6ac73 38%, #b6a6e0 92%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <div
            style={{
              width: 3,
              height: 6,
              background: "#2a2030",
              borderRadius: 999,
            }}
          />
          <div
            style={{
              width: 3,
              height: 6,
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
