import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "장군 AI 경기 분석";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Params = Promise<{ league: string; date: string; matchup: string }>;

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export default async function Image({ params }: { params: Params }) {
  const { league, date, matchup } = await params;
  const decoded = safeDecode(matchup);
  const [away = "원정팀", home = "홈팀"] = decoded.split("-vs-");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 64, background: "linear-gradient(135deg, #020617 0%, #1e3a8a 55%, #0f172a 100%)", color: "white", textAlign: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 800, opacity: 0.85 }}>{league.toUpperCase()} AI 경기 분석</div>
        <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 48, fontSize: 64, fontWeight: 900 }}>
          <span>{away}</span><span style={{ opacity: 0.65 }}>VS</span><span>{home}</span>
        </div>
        <div style={{ fontSize: 30, marginTop: 42, opacity: 0.8 }}>{date} · 장군 AI</div>
      </div>
    ),
    size,
  );
}
