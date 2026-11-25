import { ImageResponse } from "next/og";
export const alt = "SceneStack — Your entertainment. Your universe.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "75px 85px",
        color: "#f5f5f7",
        background: "radial-gradient(ellipse at 95% 0%, #303749, #090a0d 70%)",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 38,
          fontWeight: 700,
        }}
      >
        <div
          style={{
            width: 28,
            height: 34,
            background: "#f2a23a",
            borderRadius: 7,
          }}
        />
        SceneStack<span style={{ color: "#f2a23a" }}>.</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 78,
            letterSpacing: -4,
            lineHeight: 1.05,
            maxWidth: 880,
          }}
        >
          <div>Your entertainment.</div>
          <div>Your universe.</div>
        </div>
        <div style={{ fontSize: 25, color: "#a1a1aa" }}>
          Discover. Track. Collect.
        </div>
      </div>
      <div style={{ width: 80, height: 4, background: "#f2a23a" }} />
    </div>,
    size,
  );
}
