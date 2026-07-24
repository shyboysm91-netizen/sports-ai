export const NPB_TEAMS: Record<string, { code: string; ko: string; league: "Central" | "Pacific" }> = {
  "Hanshin Tigers": { code: "t", ko: "한신 타이거스", league: "Central" },
  "Yomiuri Giants": { code: "g", ko: "요미우리 자이언츠", league: "Central" },
  "YOKOHAMA DeNA BAYSTARS": { code: "db", ko: "요코하마 DeNA 베이스타스", league: "Central" },
  "Chunichi Dragons": { code: "d", ko: "주니치 드래건스", league: "Central" },
  "Hiroshima Toyo Carp": { code: "c", ko: "히로시마 도요 카프", league: "Central" },
  "Tokyo Yakult Swallows": { code: "s", ko: "도쿄 야쿠르트 스왈로스", league: "Central" },
  "Fukuoka SoftBank Hawks": { code: "h", ko: "후쿠오카 소프트뱅크 호크스", league: "Pacific" },
  "Hokkaido Nippon-Ham Fighters": { code: "f", ko: "홋카이도 닛폰햄 파이터스", league: "Pacific" },
  "ORIX Buffaloes": { code: "b", ko: "오릭스 버팔로스", league: "Pacific" },
  "Tohoku Rakuten Golden Eagles": { code: "e", ko: "도호쿠 라쿠텐 골든이글스", league: "Pacific" },
  "Saitama Seibu Lions": { code: "l", ko: "사이타마 세이부 라이온스", league: "Pacific" },
  "Chiba Lotte Marines": { code: "m", ko: "지바 롯데 마린스", league: "Pacific" },
};

export function findTeam(value: string) {
  const clean = value.trim().toLowerCase();
  return Object.entries(NPB_TEAMS).find(([english, data]) =>
    english.toLowerCase() === clean || data.ko.toLowerCase() === clean,
  )?.[1] ?? null;
}

export function cleanHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tableRows(html: string) {
  return (html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [])
    .map((row) => (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(cleanHtml))
    .filter((cells) => cells.length > 1);
}

export function num(value: string | undefined) {
  const parsed = Number((value ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function inningsToOuts(value: string | undefined) {
  const text = (value ?? "0").trim();
  const [whole, fraction = "0"] = text.split(".");
  const outs = Number(whole || 0) * 3 + (fraction === "1" ? 1 : fraction === "2" ? 2 : 0);
  return Number.isFinite(outs) ? outs : 0;
}

export function outsToInnings(outs: number) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}


const JAPANESE_NAME_OVERRIDES: Record<string, string> = {
  "西舘 昂汰": "니시다테 코타",
  "栗林 良吏": "구리바야시 료지",
  "涌井 秀章": "와쿠이 히데아키",
  "Ｏ．ビド": "오스틴 비도",
  "伊原 陵人": "이하라 타카토",
  "竹丸 和幸": "다케마루 카즈유키",
  "加藤 貴之": "가토 다카유키",
  "荘司 康誠": "쇼지 코세이",
  "武内 夏暉": "다케우치 나츠키",
  "大津 亮介": "오쓰 료스케",
  "Ｓ．ジェリー": "스펜서 젤리",
  "廣池 康志郎": "히로이케 코시로",
  "アドゥワ 誠": "아두와 마코토",
  "高橋 奎二": "다카하시 게이지",
};

export function normalizePitcherName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s・.·,，'’"()（）*+_-]/g, "");
}

const NAME_OVERRIDES: Record<string,string> = {
  "Nishidate, Kota":"니시다테 코타","Nishidate, Kouta":"니시다테 코타",
  "Kuribayashi, Ryoji":"구리바야시 료지","Kuribayashi, Ryouji":"구리바야시 료지",
  "Wakui, Hideaki":"와쿠이 히데아키","Ihara, Takato":"이하라 타카토",
  "Takemaru, Kazuyuki":"다케마루 카즈유키","Kato, Takayuki":"가토 다카유키",
  "Shoji, Kosei":"쇼지 코세이","Takeuchi, Natsuki":"다케우치 나츠키",
  "Otsu, Ryosuke":"오쓰 료스케","Hiroike, Koshiro":"히로이케 코시로",
  "Okugawa, Yasunobu":"오쿠가와 야스노부","Yamano, Taichi":"야마노 다이치","Matsumoto, Kengo":"마쓰모토 겐고","Yoshimura, Kojiro":"요시무라 고지로","Takanashi, Hirotoshi":"다카나시 히로토시",
  "Kanemaru, Yumeto":"가네마루 유메토","Yanagi, Yuya":"야나기 유야","Ohno, Yudai":"오노 유다이","Takahashi, Hiroto":"다카하시 히로토","Muller, Kyle":"카일 뮬러",
  "Ogawa, Yasuhiro":"오가와 야스히로","Takahashi, Keiji":"다카하시 게이지","Shimizu, Noboru":"시미즈 노보루","Taguchi, Kazuto":"다구치 가즈토","Kizawa, Naofumi":"기자와 나오후미",
  "Quijada, Jose":"호세 키하다","Liranzo, Jesus":"헤수스 리란조","Santana, Domingo":"도밍고 산타나","Osuna, Jose":"호세 오수나"
};
const ROMAJI: [string,string][] = [
 ["kyo","쿄"],["kyu","큐"],["kya","캬"],["sho","쇼"],["shu","슈"],["sha","샤"],["cho","초"],["chu","추"],["cha","차"],["ryo","료"],["ryu","류"],["rya","랴"],["nyo","뇨"],["nyu","뉴"],["nya","냐"],["hyo","효"],["hyu","휴"],["hya","햐"],["myo","묘"],["myu","뮤"],["mya","먀"],["gyo","교"],["gyu","규"],["gya","갸"],["byo","뵤"],["byu","뷰"],["bya","뱌"],["pyo","표"],["pyu","퓨"],["pya","퍄"],["tsu","쓰"],["shi","시"],["chi","치"],["fu","후"],["ji","지"],
 ["ka","카"],["ki","키"],["ku","쿠"],["ke","케"],["ko","코"],["ga","가"],["gi","기"],["gu","구"],["ge","게"],["go","고"],["sa","사"],["su","스"],["se","세"],["so","소"],["za","자"],["zu","즈"],["ze","제"],["zo","조"],["ta","타"],["te","테"],["to","토"],["da","다"],["de","데"],["do","도"],["na","나"],["ni","니"],["nu","누"],["ne","네"],["no","노"],["ha","하"],["hi","히"],["he","헤"],["ho","호"],["ba","바"],["bi","비"],["bu","부"],["be","베"],["bo","보"],["pa","파"],["pi","피"],["pu","푸"],["pe","페"],["po","포"],["ma","마"],["mi","미"],["mu","무"],["me","메"],["mo","모"],["ya","야"],["yu","유"],["yo","요"],["ra","라"],["ri","리"],["ru","루"],["re","레"],["ro","로"],["wa","와"],["wo","오"],["a","아"],["i","이"],["u","우"],["e","에"],["o","오"],["n","ㄴ"]
];
function romanTokenToKo(token:string){
 let s=token.toLowerCase().replace(/[^a-z]/g,""); let out="";
 while(s){let matched=false; for(const [r,k] of ROMAJI){if(s.startsWith(r)){out+=k;s=s.slice(r.length);matched=true;break;}} if(!matched){out+=s[0].toUpperCase();s=s.slice(1);}}
 return out.replace(/ㄴ(?=[가-힣])/g,"ㄴ").replace(/ㄴ$/,"ㄴ");
}
export function playerNameKo(name:string){
 const clean=name.replace(/^[*+]/,"").normalize("NFKC").replace(/[\s　]+/g," ").trim();
 const japaneseOverride=Object.entries(JAPANESE_NAME_OVERRIDES).find(([key])=>normalizePitcherName(key)===normalizePitcherName(clean))?.[1];
 if(japaneseOverride) return japaneseOverride;
 const romanOverride=Object.entries(NAME_OVERRIDES).find(([key])=>normalizePitcherName(key)===normalizePitcherName(clean))?.[1];
 if(romanOverride) return romanOverride;
 // 일본 한자/가나 이름은 임의 로마자 변환을 하지 않습니다. 매핑이 없으면 원문을 유지합니다.
 if(/[一-龯ぁ-んァ-ヶ]/.test(clean)) return clean;
 const parts=clean.split(",").map(x=>x.trim()).filter(Boolean); const ordered=parts.length===2?[parts[0],...parts[1].split(/\s+/)]:clean.split(/\s+/);
 return ordered.map(romanTokenToKo).join(" ");
}
