import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sports AI KBO MLB NPB 야구 분석";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background: "linear-gradient(135deg, #020617 0%, #172554 55%, #0f172a 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.8 }}>KBO · MLB · NPB</div>
        <div style={{ fontSize: 88, fontWeight: 900, marginTop: 20 }}>Sports AI</div>
        <div style={{ fontSize: 42, marginTop: 24 }}>선발 · 최근 기록 · 맞대결 · AI 승부예측</div>
      </div>
    ),
    size,
  );
}
