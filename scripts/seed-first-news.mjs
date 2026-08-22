import fs from "node:fs";
import crypto from "node:crypto";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
    }),
);

const now = new Date().toISOString();
const title = "구리야마 전 일본대표팀 감독 KBO 방문…한일 야구 교류 확대 논의";
const summary = "WBC 우승을 이끈 구리야마 히데키 전 일본대표팀 감독이 KBO를 찾아 양국 야구 발전과 교류 확대 방안을 논의했다. 당장 리그 순위를 바꾸는 소식은 아니지만 선수 육성과 운영 경험을 나누는 장기 협력의 출발점이라는 의미가 있다.";
const row = {
  id: crypto.randomUUID(), title,
  slug: "kuriyama-kbo-korea-japan-baseball-cooperation-20260822", summary,
  content: {
    whatHappened: [
      "구리야마 히데키 전 일본 야구대표팀 감독이 KBO를 방문해 한국과 일본 야구의 발전 방향을 논의했다. 구리야마는 일본 대표팀을 이끌었던 지도자이자 닛폰햄 구단 운영에 참여한 인물이다.",
      "이번 만남에서는 양국 야구의 교류 확대와 국제 경쟁력 강화를 위한 육성 방안 등이 주요 의제로 다뤄졌다. 여러 국내 매체가 같은 방문과 협력 논의를 보도했다.",
    ],
    keyPoints: [
      "KBO와 일본 야구계 관계자가 선수 육성과 교류 확대 방안을 논의했다.",
      "대표팀 운영 경험과 프로구단 육성 시스템을 공유할 가능성이 열렸다.",
      "구체적인 교류 프로그램과 시행 일정은 향후 발표를 확인해야 한다.",
    ],
    analysis: [
      "이번 만남은 특정 구단의 즉각적인 전력 보강보다 리그 차원의 장기 협력에 가깝다. 따라서 단기 성적 변화로 연결해 해석하는 것은 이르다.",
      "일본의 선수 육성 및 대표팀 운영 경험이 실제 프로그램으로 이어진다면 유소년 육성, 지도자 교류, 국제대회 준비 과정에서 참고할 부분이 생길 수 있다.",
      "가장 중요한 다음 단계는 논의가 정기 교류전, 지도자 연수, 데이터 공유 같은 구체적인 사업으로 연결되는지 확인하는 것이다.",
    ],
    data: [
      { label: "이번 논의의 성격", value: "한일 야구 발전 및 교류 확대 협의", source: "KBO 관련 보도" },
      { label: "구리야마의 주요 경력", value: "일본 야구대표팀 감독 및 닛폰햄 구단 운영 참여", source: "연합뉴스·조선일보 등" },
    ],
    outlook: [
      "KBO가 후속 협력 일정과 구체적인 실행 계획을 발표하는지 지켜봐야 한다.",
      "선수·지도자 교류가 실제 프로그램으로 이어지는지가 이번 만남의 실질적인 성과를 판단할 기준이다.",
    ],
  },
  category: "KBO", image_url: "/news-korea-japan-baseball-cooperation.png",
  source_urls: [
    "https://news.google.com/rss/articles/CBMiYEFVX3lxTFBJbkFsaS11dS15UVlTYVEweHlyOGJVSkVSeWMxRlZHSXF3WkI2YXZMYmtycmNDTl9pdDJGNGNDR2hkMmc4d3dmTGhNMDB3ZGx2OFM4ZmNRUlFDY0lFMGpldQ?oc=5",
    "https://news.google.com/rss/articles/CBMigwFBVV95cUxNM1BIOHNrWjQyaE8ybFpJdVdfYWVibFQzWlNsejVQMHF3eXd0UGxmc3hKeHoyQzdFMkUtMUlDLWo4bXNmQUljdmNpTkpOWHlPaFVyTEVSVnBOMXJtSExnY2hpUk96dVhfMXdDc1FQN292Z3F3RjczSm50aWRuMEJnZUhlTQ?oc=5",
  ],
  source_names: ["연합뉴스", "조선일보"], players: ["구리야마 히데키"], teams: ["KBO", "닛폰햄 파이터즈"],
  source_published_at: "2026-08-21T07:22:25.000Z", published_at: now, status: "published",
  seo_title: title, seo_description: summary.slice(0, 150),
  content_hash: crypto.createHash("sha256").update(`${title}|${summary}`).digest("hex"),
  normalized_title: "구리야마 전 일본대표팀 감독 kbo 방문 한일 야구 교류 확대 논의", reading_minutes: 3,
};

const baseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const response = await fetch(`${baseUrl}/rest/v1/news?on_conflict=slug`, {
  method: "POST",
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(row),
});
const text = await response.text();
if (!response.ok) throw new Error(`${response.status} ${text}`);
const article = JSON.parse(text)[0];
console.log(JSON.stringify({ ok: true, title: article.title, slug: article.slug }));
