export type AnalysisLeague = "kbo" | "mlb" | "npb";

const KBO: Record<string, { slug: string; name: string }> = {
  "kia 타이거즈": { slug: "kia", name: "KIA 타이거즈" },
  kia: { slug: "kia", name: "KIA 타이거즈" },
  "삼성 라이온즈": { slug: "samsung", name: "삼성 라이온즈" },
  samsung: { slug: "samsung", name: "삼성 라이온즈" },
  "lg 트윈스": { slug: "lg", name: "LG 트윈스" },
  lg: { slug: "lg", name: "LG 트윈스" },
  "두산 베어스": { slug: "doosan", name: "두산 베어스" },
  doosan: { slug: "doosan", name: "두산 베어스" },
  "kt 위즈": { slug: "kt", name: "KT 위즈" },
  kt: { slug: "kt", name: "KT 위즈" },
  "ssg 랜더스": { slug: "ssg", name: "SSG 랜더스" },
  ssg: { slug: "ssg", name: "SSG 랜더스" },
  "롯데 자이언츠": { slug: "lotte", name: "롯데 자이언츠" },
  lotte: { slug: "lotte", name: "롯데 자이언츠" },
  "한화 이글스": { slug: "hanwha", name: "한화 이글스" },
  hanwha: { slug: "hanwha", name: "한화 이글스" },
  "nc 다이노스": { slug: "nc", name: "NC 다이노스" },
  nc: { slug: "nc", name: "NC 다이노스" },
  "키움 히어로즈": { slug: "kiwoom", name: "키움 히어로즈" },
  kiwoom: { slug: "kiwoom", name: "키움 히어로즈" },
};

const MLB_NAMES = [
  ["LA 에인절스", "angels"], ["Los Angeles Angels", "angels"],
  ["애리조나 다이아몬드백스", "diamondbacks"], ["Arizona Diamondbacks", "diamondbacks"],
  ["볼티모어 오리올스", "orioles"], ["Baltimore Orioles", "orioles"],
  ["보스턴 레드삭스", "red-sox"], ["Boston Red Sox", "red-sox"],
  ["시카고 컵스", "cubs"], ["Chicago Cubs", "cubs"],
  ["신시내티 레즈", "reds"], ["Cincinnati Reds", "reds"],
  ["클리블랜드 가디언스", "guardians"], ["Cleveland Guardians", "guardians"],
  ["콜로라도 로키스", "rockies"], ["Colorado Rockies", "rockies"],
  ["디트로이트 타이거스", "tigers"], ["Detroit Tigers", "tigers"],
  ["휴스턴 애스트로스", "astros"], ["Houston Astros", "astros"],
  ["캔자스시티 로열스", "royals"], ["Kansas City Royals", "royals"],
  ["LA 다저스", "dodgers"], ["Los Angeles Dodgers", "dodgers"],
  ["워싱턴 내셔널스", "nationals"], ["Washington Nationals", "nationals"],
  ["뉴욕 메츠", "mets"], ["New York Mets", "mets"],
  ["애슬레틱스", "athletics"], ["Athletics", "athletics"], ["Oakland Athletics", "athletics"],
  ["피츠버그 파이리츠", "pirates"], ["Pittsburgh Pirates", "pirates"],
  ["샌디에이고 파드리스", "padres"], ["San Diego Padres", "padres"],
  ["시애틀 매리너스", "mariners"], ["Seattle Mariners", "mariners"],
  ["샌프란시스코 자이언츠", "giants"], ["San Francisco Giants", "giants"],
  ["세인트루이스 카디널스", "cardinals"], ["St. Louis Cardinals", "cardinals"],
  ["탬파베이 레이스", "rays"], ["Tampa Bay Rays", "rays"],
  ["텍사스 레인저스", "rangers"], ["Texas Rangers", "rangers"],
  ["토론토 블루제이스", "blue-jays"], ["Toronto Blue Jays", "blue-jays"],
  ["미네소타 트윈스", "twins"], ["Minnesota Twins", "twins"],
  ["필라델피아 필리스", "phillies"], ["Philadelphia Phillies", "phillies"],
  ["애틀랜타 브레이브스", "braves"], ["Atlanta Braves", "braves"],
  ["시카고 화이트삭스", "white-sox"], ["Chicago White Sox", "white-sox"],
  ["마이애미 말린스", "marlins"], ["Miami Marlins", "marlins"],
  ["뉴욕 양키스", "yankees"], ["New York Yankees", "yankees"],
  ["밀워키 브루어스", "brewers"], ["Milwaukee Brewers", "brewers"],
] as const;

const NPB_NAMES = [
  ["한신 타이거스", "hanshin"], ["한신 타이거즈", "hanshin"], ["한신", "hanshin"],
  ["요미우리 자이언츠", "yomiuri"], ["요미우리", "yomiuri"],
  ["요코하마 DeNA 베이스타스", "yokohama"], ["요코하마 DeNA 베이스타즈", "yokohama"], ["요코하마", "yokohama"],
  ["주니치 드래건스", "chunichi"], ["주니치", "chunichi"],
  ["히로시마 도요 카프", "hiroshima"], ["히로시마", "hiroshima"],
  ["도쿄 야쿠르트 스왈로스", "yakult"], ["야쿠르트", "yakult"],
  ["후쿠오카 소프트뱅크 호크스", "softbank"], ["소프트뱅크", "softbank"],
  ["홋카이도 닛폰햄 파이터스", "nipponham"], ["홋카이도 닛폰햄 파이터즈", "nipponham"], ["닛폰햄", "nipponham"], ["니혼햄", "nipponham"],
  ["오릭스 버팔로스", "orix"], ["오릭스", "orix"],
  ["도호쿠 라쿠텐 골든이글스", "rakuten"], ["라쿠텐", "rakuten"],
  ["사이타마 세이부 라이온스", "seibu"], ["사이타마 세이부 라이온즈", "seibu"], ["세이부", "seibu"],
  ["지바 롯데 마린스", "chiba-lotte"], ["치바롯데 마린스", "chiba-lotte"], ["치바롯데", "chiba-lotte"],
] as const;

function makeMap(entries: readonly (readonly [string, string])[]) {
  const byName = new Map<string, string>();
  const bySlug = new Map<string, string>();
  for (const [name, slug] of entries) {
    byName.set(name.toLowerCase(), slug);
    if (!bySlug.has(slug)) bySlug.set(slug, name);
  }
  return { byName, bySlug };
}

const MLB = makeMap(MLB_NAMES);
const NPB = makeMap(NPB_NAMES);

function fallbackSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || encodeURIComponent(value.trim());
}

export function teamSlug(league: AnalysisLeague, team: string) {
  const key = team.trim().toLowerCase();
  if (league === "kbo") return KBO[key]?.slug ?? fallbackSlug(team);
  if (league === "mlb") return MLB.byName.get(key) ?? fallbackSlug(team);
  return NPB.byName.get(key) ?? fallbackSlug(team);
}

export function teamNameFromSlug(league: AnalysisLeague, value: string) {
  const decoded = decodeURIComponent(value).trim();
  const key = decoded.toLowerCase();
  if (league === "kbo") return KBO[key]?.name ?? decoded;
  if (league === "mlb") return MLB.bySlug.get(key) ?? decoded;
  return NPB.bySlug.get(key) ?? decoded;
}

export function matchupSlug(league: AnalysisLeague, away: string, home: string) {
  return `${teamSlug(league, away)}-vs-${teamSlug(league, home)}`;
}
