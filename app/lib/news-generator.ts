import "server-only";
import { createHash, randomUUID } from "crypto";
import { collectNewsCandidates, clusterCandidates, normalizeNewsTitle, titleSimilarity } from "./news-collector";
import { getNewsAutomationEnabled, insertNews, listNews, recentNewsForDuplicateCheck } from "./news-db";
import type { NewsArticle, NewsCandidate, NewsCategory, NewsContent } from "./news-types";
import { generateNewsImage } from "./news-image";

function hash(value:string){ return createHash("sha256").update(value).digest("hex"); }
function slugify(value:string){ const ascii=value.toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-").replace(/^-|-$/g,""); return `${ascii.slice(0,80)}-${new Date().toISOString().slice(0,10).replaceAll("-","")}`; }
function parseJson(value:string){ const cleaned=value.replace(/^```json\s*/i,"").replace(/```$/," ").trim(); return JSON.parse(cleaned); }

function cleanSourceSuffix(title:string){return title.replace(/\s+-\s+[^-]+$/," ").trim();}
function composeSafeFallback(sources:NewsCandidate[]){
  const main=sources[0]; const title=cleanSourceSuffix(main.title);
  const names=[...new Set(sources.map(source=>source.sourceName))];
  const reports=sources.slice(0,4).map(source=>`${source.sourceName}은(는) '${cleanSourceSuffix(source.title)}'라는 내용으로 관련 소식을 보도했습니다.`);
  const categoryImpact:Record<NewsCategory,string>={
    KBO:"이번 소식이 선수 기용이나 순위 경쟁에 직접 영향을 주는지는 구단과 KBO의 후속 발표, 다음 경기 엔트리를 함께 확인해야 합니다.",
    MLB:"MLB 일정과 로스터는 수시로 바뀌므로 구단의 공식 발표와 다음 경기 라인업이 실제 영향을 판단하는 기준입니다.",
    NPB:"NPB 구단의 공식 기록과 다음 경기 출전 명단을 확인해야 이번 소식이 팀 전력에 미치는 영향을 정확히 판단할 수 있습니다.",
    축구:"축구 이슈는 공식 명단과 구단 발표 전까지 변수가 많아 다음 경기 선발 명단과 감독 설명을 함께 확인해야 합니다.",
    NBA:"NBA 로스터와 부상 상태는 빠르게 바뀌므로 구단 공식 발표와 다음 경기 출전 상태를 확인해야 합니다.",
    기타:"후속 공식 발표와 경기 기록이 나오기 전에는 확인된 사실의 범위를 넘어 결과를 단정하지 않는 것이 중요합니다.",
  };
  return {title,summary:`${names.join("·")} 등 공개 출처에서 '${title}' 관련 소식이 확인됐습니다. 공개된 제목과 발행 정보를 기준으로 핵심 내용과 앞으로 확인할 부분을 정리했습니다.`,whatHappened:reports,keyPoints:[...new Set(sources.slice(0,4).map(source=>cleanSourceSuffix(source.title)))],analysis:[categoryImpact[main.category],"한 번의 보도만으로 장기적인 경기력이나 팀 성적 변화를 단정하기보다 공식 기록과 후속 발표를 함께 보는 것이 안전합니다."],data:[],outlook:["소속 팀 또는 대회 주최 측의 공식 발표가 추가되는지 확인해야 합니다.","다음 경기 출전 명단과 실제 기록이 보도의 영향을 판단할 핵심 자료입니다."],players:[],teams:[],seoTitle:title,seoDescription:`${title} 관련 최신 보도와 장군분석 해설을 정리했습니다.`};
}

async function composeWithOpenAI(sources: NewsCandidate[]) {
  const apiKey=process.env.OPENAI_API_KEY||process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN; if(!apiKey) return composeSafeFallback(sources);
  const apiBase=process.env.OPENAI_API_KEY?"https://api.openai.com/v1":"https://ai-gateway.vercel.sh/v1";
  const model=process.env.NEWS_OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
  const evidence=sources.slice(0,5).map((s,i)=>`${i+1}. [${s.sourceName}] ${s.title}\n게시: ${s.publishedAt}\n피드 요약: ${s.summary}`).join("\n\n");
  const prompt=`당신은 한국 스포츠 미디어 '장군분석'의 편집자다. 아래 공개 뉴스 피드의 제목과 짧은 요약에 공통으로 확인되는 사실만 사용해 완전히 새로운 한국어 기사를 작성하라. 원문 문장을 복사하거나 긴 인용을 하지 말고, 확인되지 않은 숫자와 예측은 만들지 마라. 서로 충돌하는 내용은 단정하지 말라.\n\n${evidence}\n\nJSON만 반환한다: {"title":"사실 중심 SEO 제목","summary":"1~2문장","whatHappened":["2~4개 문단"],"keyPoints":["3~5개"],"analysis":["전력·다음 경기·순위 등에 미치는 근거 있는 해설 2~4개"],"data":[{"label":"확인된 지표","value":"수치 또는 설명","source":"출처명"}],"outlook":["앞으로 확인할 점 2~3개"],"players":["선수"],"teams":["팀"],"seoTitle":"60자 안팎","seoDescription":"150자 안팎"}. 데이터가 없으면 data는 빈 배열로 둔다.`;
  const response=await fetch(`${apiBase}/responses`,{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:prompt,text:{format:{type:"json_object"}}}),cache:"no-store"});
  if(!response.ok) throw new Error(`OpenAI 뉴스 작성 실패: ${response.status} ${await response.text()}`);
  const json=await response.json(); const text=json.output_text || json.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
  if(!text) throw new Error("OpenAI 응답에 기사 내용이 없습니다.");
  return parseJson(text) as { title:string;summary:string;whatHappened:string[];keyPoints:string[];analysis:string[];data:Array<{label:string;value:string;source?:string}>;outlook:string[];players:string[];teams:string[];seoTitle:string;seoDescription:string };
}

function chooseCluster(clusters: NewsCandidate[][], existing: Awaited<ReturnType<typeof recentNewsForDuplicateCheck>>, today: NewsArticle[]) {
  const counts=new Map<NewsCategory,number>(); today.forEach(n=>counts.set(n.category,(counts.get(n.category)||0)+1));
  const targets:Record<NewsCategory,number>={KBO:2,MLB:2,NPB:0,축구:2,NBA:1,기타:0};
  const score=(group:NewsCandidate[])=>Math.max(0,(targets[group[0].category]||0)-(counts.get(group[0].category)||0))*30+group[0].score+group.length*15;
  return clusters.filter(group=>!group.some(item=>existing.some(row=>row.source_urls?.includes(item.url)||titleSimilarity(row.normalized_title||row.title,item.title)>=0.68))).sort((a,b)=>score(b)-score(a))[0];
}

export async function generateOneNewsArticle(options:{force?:boolean;status?:"draft"|"published";publishedAt?:string}={}) {
  if(!options.force && !(await getNewsAutomationEnabled())) return { skipped:true, reason:"자동 생성이 꺼져 있습니다." };
  const candidates=await collectNewsCandidates(); if(!candidates.length) return {skipped:true,reason:"최근 24시간 내 적합한 뉴스 후보가 없습니다."};
  const existing=await recentNewsForDuplicateCheck();
  const todayStart=new Date(); todayStart.setHours(0,0,0,0);
  const today=(await listNews({status:"all",limit:100})).filter(n=>new Date(n.createdAt)>=todayStart);
  if(!options.force&&today.length>=7) return {skipped:true,reason:"오늘 게시 목표 7개를 이미 채웠습니다."};
  const group=chooseCluster(clusterCandidates(candidates),existing,today); if(!group) return {skipped:true,reason:"중복이 아닌 중요한 뉴스가 없습니다."};
  const generated=await composeWithOpenAI(group);
  const normalizedTitle=normalizeNewsTitle(generated.title), contentHash=hash(`${normalizedTitle}|${generated.summary}|${generated.keyPoints.join("|")}`);
  if(existing.some(row=>row.content_hash===contentHash||titleSimilarity(row.normalized_title||row.title,normalizedTitle)>=0.72)) return {skipped:true,reason:"생성 결과가 최근 기사와 유사합니다."};
  const words=[generated.summary,...generated.whatHappened,...generated.keyPoints,...generated.analysis,...generated.outlook].join(" ").length;
  const now=options.publishedAt||new Date().toISOString(); const content:NewsContent={whatHappened:generated.whatHappened,keyPoints:generated.keyPoints,analysis:generated.analysis,data:generated.data||[],outlook:generated.outlook};
  const slug=slugify(generated.title);
  const imageUrl=await generateNewsImage({title:generated.title,category:group[0].category,summary:generated.summary,slug});
  const article=await insertNews({id:randomUUID(),title:generated.title,slug,summary:generated.summary,content,category:group[0].category,imageUrl,sourceUrls:[...new Set(group.slice(0,5).map(s=>s.url))],sourceNames:[...new Set(group.slice(0,5).map(s=>s.sourceName))],players:generated.players||[],teams:generated.teams||[],sourcePublishedAt:group[0].publishedAt,publishedAt:now,status:options.status||"published",seoTitle:generated.seoTitle||generated.title,seoDescription:generated.seoDescription||generated.summary,contentHash,normalizedTitle,readingMinutes:Math.max(2,Math.ceil(words/500))});
  return {skipped:false,article};
}
