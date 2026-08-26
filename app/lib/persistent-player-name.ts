import { readSportsCache, writeSportsCache } from "./sports-db-cache";

export type PlayerNameInput = { id: string; name: string; fixed?: string };

const TEN_YEARS = 10 * 365 * 24 * 60 * 60;

function cacheKey(league: string, id: string) {
  return `/player-name-ko/${league.toLowerCase()}/${encodeURIComponent(id)}`;
}

function validKoreanName(value: unknown) {
  const name = String(value ?? "").trim();
  return name.length >= 2 && /[가-힣]/.test(name) && !/[A-Za-z一-龯ぁ-んァ-ヶ]/.test(name);
}

async function translateWithOpenAI(league: string, players: PlayerNameInput[]) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!apiKey || !players.length) return new Map<string, string>();
  const apiBase = process.env.OPENAI_API_KEY ? "https://api.openai.com/v1" : "https://ai-gateway.vercel.sh/v1";
  try {
    const prompt = `다음 ${league.toUpperCase()} 야구 선수의 공식 영문 이름을 한국 스포츠 기사에서 쓰는 자연스러운 한글 표기로 음역하라. 뜻을 번역하지 말고 사람을 바꾸거나 추측하지 마라. JSON은 {"names":{"선수ID":"한글 이름"}} 형식만 반환한다.\n${JSON.stringify(players.map(({ id, name }) => ({ id, name })))}`;
    const response = await fetch(`${apiBase}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        input: prompt,
        text: { format: { type: "json_object" } },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return new Map();
    const payload = await response.json();
    const outputText = payload?.output_text || payload?.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || []).find((item: { type?: string }) => item.type === "output_text")?.text;
    const parsed = JSON.parse(String(outputText ?? "{}"));
    const result = new Map<string, string>();
    for (const player of players) {
      const localized = String(parsed?.names?.[player.id] ?? "").trim();
      if (validKoreanName(localized)) result.set(player.id, localized);
    }
    return result;
  } catch {
    return new Map();
  }
}

/**
 * Player IDs are stable while daily schedules are not. New names are converted once,
 * validated, and kept in the shared database for ten years. If conversion is unavailable,
 * the readable official name is returned instead of fabricated letter-by-letter Hangul.
 */
export async function persistentPlayerNamesKo(league: string, input: PlayerNameInput[]) {
  const players = [...new Map(input.filter((p) => p.id && p.name).map((p) => [p.id, p])).values()];
  const result = new Map<string, string>();
  const missing: PlayerNameInput[] = [];

  await Promise.all(players.map(async (player) => {
    if (player.fixed && validKoreanName(player.fixed)) {
      result.set(player.id, player.fixed);
      return;
    }
    const cached = await readSportsCache(cacheKey(league, player.id));
    const cachedName = String((cached?.payload as { name?: string } | null)?.name ?? "").trim();
    if (validKoreanName(cachedName)) result.set(player.id, cachedName);
    else missing.push(player);
  }));

  const translated = await translateWithOpenAI(league, missing);
  await Promise.all(missing.map(async (player) => {
    const localized = translated.get(player.id);
    if (!localized) return;
    result.set(player.id, localized);
    await writeSportsCache(cacheKey(league, player.id), {
      id: player.id, originalName: player.name, name: localized, source: "validated-transliteration-v1",
    }, TEN_YEARS);
  }));

  return result;
}
