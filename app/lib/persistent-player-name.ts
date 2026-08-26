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
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You transliterate professional baseball player names into standard Korean sports-news spelling. Never translate the meaning. Return JSON only as {\"names\":{\"player-id\":\"Korean name\"}}. Preserve initials naturally and do not invent people." },
          { role: "user", content: JSON.stringify({ league, players: players.map(({ id, name }) => ({ id, name })) }) },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return new Map();
    const payload = await response.json();
    const parsed = JSON.parse(String(payload?.choices?.[0]?.message?.content ?? "{}"));
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
