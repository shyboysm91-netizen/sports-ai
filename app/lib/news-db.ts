import "server-only";
import type { NewsArticle, NewsContent, NewsStatus } from "./news-types";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function configured() { return Boolean(url && key); }
function headers(extra: Record<string, string> = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

function fromRow(row: Record<string, any>): NewsArticle {
  return {
    id: row.id, title: row.title, slug: row.slug, summary: row.summary,
    content: (row.content || {}) as NewsContent, category: row.category,
    imageUrl: row.image_url || "/news-default.svg", sourceUrls: row.source_urls || [],
    sourceNames: row.source_names || [], players: row.players || [], teams: row.teams || [],
    sourcePublishedAt: row.source_published_at || null, publishedAt: row.published_at,
    createdAt: row.created_at, updatedAt: row.updated_at, status: row.status,
    seoTitle: row.seo_title || row.title, seoDescription: row.seo_description || row.summary,
    contentHash: row.content_hash, normalizedTitle: row.normalized_title,
    readingMinutes: Number(row.reading_minutes || 3),
  };
}

export function newsDbConfigured() { return configured(); }

export async function listNews(options: { status?: NewsStatus | "all"; category?: string; limit?: number } = {}) {
  if (!configured()) return [];
  const parts = ["select=*", `limit=${Math.min(options.limit || 50, 200)}`, "order=published_at.desc"];
  if (options.status && options.status !== "all") parts.push(`status=eq.${encodeURIComponent(options.status)}`);
  if (options.status === "published") parts.push(`published_at=lte.${encodeURIComponent(new Date().toISOString())}`);
  if (options.category && options.category !== "전체") parts.push(`category=eq.${encodeURIComponent(options.category)}`);
  const response = await fetch(`${url}/rest/v1/news?${parts.join("&")}`, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error(`뉴스 조회 실패: ${await response.text()}`);
  return ((await response.json()) as Record<string, any>[]).map(fromRow);
}

export async function getNewsBySlug(slug: string, includePrivate = false) {
  if (!configured()) return null;
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // 이미 디코딩된 slug이거나 잘못된 퍼센트 문자열이면 원본으로 조회합니다.
  }
  const status = includePrivate ? "" : `&status=eq.published&published_at=lte.${encodeURIComponent(new Date().toISOString())}`;
  const response = await fetch(`${url}/rest/v1/news?slug=eq.${encodeURIComponent(decodedSlug)}${status}&select=*&limit=1`, { headers: headers(), cache: "no-store" });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function recentNewsForDuplicateCheck(days = 14) {
  if (!configured()) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const response = await fetch(`${url}/rest/v1/news?created_at=gte.${encodeURIComponent(since)}&select=id,title,normalized_title,content_hash,source_urls&limit=300`, { headers: headers(), cache: "no-store" });
  if (!response.ok) return [];
  return response.json() as Promise<Array<{ id:string; title:string; normalized_title:string; content_hash:string; source_urls:string[] }>>;
}

export async function insertNews(article: Omit<NewsArticle, "createdAt" | "updatedAt">) {
  if (!configured()) throw new Error("Supabase 뉴스 DB 환경변수가 설정되지 않았습니다.");
  const row = {
    id: article.id, title: article.title, slug: article.slug, summary: article.summary,
    content: article.content, category: article.category, image_url: article.imageUrl,
    source_urls: article.sourceUrls, source_names: article.sourceNames,
    players: article.players, teams: article.teams, source_published_at: article.sourcePublishedAt || null,
    published_at: article.publishedAt, status: article.status, seo_title: article.seoTitle,
    seo_description: article.seoDescription, content_hash: article.contentHash,
    normalized_title: article.normalizedTitle, reading_minutes: article.readingMinutes,
  };
  const response = await fetch(`${url}/rest/v1/news`, { method: "POST", headers: headers({ Prefer: "return=representation" }), body: JSON.stringify(row), cache: "no-store" });
  if (!response.ok) throw new Error(`뉴스 저장 실패: ${await response.text()}`);
  return fromRow((await response.json())[0]);
}

export async function updateNews(id: string, patch: Record<string, unknown>) {
  if (!configured()) throw new Error("Supabase 뉴스 DB가 설정되지 않았습니다.");
  const map: Record<string,string> = { imageUrl:"image_url", sourceUrls:"source_urls", sourceNames:"source_names", sourcePublishedAt:"source_published_at", publishedAt:"published_at", seoTitle:"seo_title", seoDescription:"seo_description", contentHash:"content_hash", normalizedTitle:"normalized_title", readingMinutes:"reading_minutes" };
  const row = Object.fromEntries(Object.entries(patch).map(([k,v]) => [map[k] || k, v]));
  row.updated_at = new Date().toISOString();
  const response = await fetch(`${url}/rest/v1/news?id=eq.${encodeURIComponent(id)}`, { method:"PATCH", headers:headers({ Prefer:"return=representation" }), body:JSON.stringify(row), cache:"no-store" });
  if (!response.ok) throw new Error(`뉴스 수정 실패: ${await response.text()}`);
  return fromRow((await response.json())[0]);
}

export async function deleteNews(id: string) {
  if (!configured()) throw new Error("Supabase 뉴스 DB가 설정되지 않았습니다.");
  const response = await fetch(`${url}/rest/v1/news?id=eq.${encodeURIComponent(id)}`, { method:"DELETE", headers:headers(), cache:"no-store" });
  if (!response.ok) throw new Error(`뉴스 삭제 실패: ${await response.text()}`);
}

export async function getNewsAutomationEnabled() {
  if (!configured()) return true;
  const response = await fetch(`${url}/rest/v1/news_settings?id=eq.default&select=enabled&limit=1`, { headers:headers(), cache:"no-store" });
  if (!response.ok) return true;
  const rows = await response.json();
  return rows[0]?.enabled !== false;
}

export async function setNewsAutomationEnabled(enabled: boolean) {
  const response = await fetch(`${url}/rest/v1/news_settings?on_conflict=id`, { method:"POST", headers:headers({ Prefer:"resolution=merge-duplicates,return=minimal" }), body:JSON.stringify({ id:"default", enabled, updated_at:new Date().toISOString() }), cache:"no-store" });
  if (!response.ok) throw new Error(`자동 생성 설정 저장 실패: ${await response.text()}`);
}
