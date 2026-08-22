import "server-only";
import type { NewsCandidate, NewsCategory } from "./news-types";

const QUERIES: Array<[NewsCategory, string]> = [
  ["KBO", "KBO 야구 when:1d"],
  ["MLB", "MLB 야구 when:1d"],
  ["NPB", "NPB 일본프로야구 when:1d"],
  ["축구", "손흥민 EPL 유럽축구 K리그 when:1d"],
  ["NBA", "NBA 농구 when:1d"],
  ["기타", "한국 선수 해외 스포츠 when:1d"],
];

const PRIORITY = ["손흥민","오타니","송성문","김하성","이정후","김혜성","류현진","부상","이적","드래프트","신기록","선발","우승"];

function decode(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
}

function tag(xml: string, name: string) {
  return decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1] || "");
}

function source(xml: string) {
  return decode(xml.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "Google 뉴스");
}

function importance(title: string, publishedAt: string) {
  const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3600000);
  let score = Math.max(0, 48 - ageHours) * 2;
  score += PRIORITY.reduce((sum, word) => sum + (title.includes(word) ? 18 : 0), 0);
  if (/부상|이적|트레이드|선발|라인업|기록|드래프트|우승|복귀|결장/i.test(title)) score += 22;
  return score;
}

export function normalizeNewsTitle(value: string) {
  return value.toLowerCase().replace(/\s+-\s+[^-]+$/," ").replace(/[^a-z0-9가-힣]/g," ").replace(/\b(속보|단독|공식|영상|종합)\b/g," ").replace(/\s+/g," ").trim();
}

function tokens(value: string) { return new Set(normalizeNewsTitle(value).split(" ").filter(v => v.length > 1)); }
export function titleSimilarity(a: string, b: string) {
  const x=tokens(a), y=tokens(b); if(!x.size||!y.size) return 0;
  const common=[...x].filter(v=>y.has(v)).length; return common / Math.max(1, Math.min(x.size,y.size));
}

export async function collectNewsCandidates() {
  const results = await Promise.all(QUERIES.map(async ([category, query]) => {
    const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    try {
      const response = await fetch(rss, { headers:{ "User-Agent":"JanggunSportsNews/1.0" }, next:{ revalidate:900 } });
      if (!response.ok) return [];
      const xml = await response.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,20).map(match => {
        const item=match[1], publishedAt=tag(item,"pubDate");
        const candidate: NewsCandidate = { title:tag(item,"title"), summary:tag(item,"description"), url:tag(item,"link"), sourceName:source(item), publishedAt:new Date(publishedAt||Date.now()).toISOString(), category, score:importance(tag(item,"title"),publishedAt) };
        return candidate;
      }).filter(item=>item.title&&item.url);
    } catch { return []; }
  }));
  return results.flat().filter(item => Date.now()-new Date(item.publishedAt).getTime() < 30*3600000).sort((a,b)=>b.score-a.score);
}

export function clusterCandidates(items: NewsCandidate[]) {
  const clusters: NewsCandidate[][]=[];
  for(const item of items){ const group=clusters.find(c=>titleSimilarity(c[0].title,item.title)>=0.48); if(group) group.push(item); else clusters.push([item]); }
  return clusters.map(group=>group.sort((a,b)=>b.score-a.score)).sort((a,b)=>(b[0].score+b.length*15)-(a[0].score+a.length*15));
}
