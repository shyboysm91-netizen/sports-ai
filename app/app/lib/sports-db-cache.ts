type CacheRow = {
  cache_key: string;
  payload: unknown;
  expires_at: string;
  updated_at: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function cacheKey(path: string) {
  return path.trim();
}

export async function readSportsCache(key: string) {
  if (!configured()) return null;

  const url =
    `${SUPABASE_URL}/rest/v1/sports_cache` +
    `?cache_key=eq.${encodeURIComponent(key)}` +
    `&select=cache_key,payload,expires_at,updated_at&limit=1`;

  const response = await fetch(url, {
    headers: headers(),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as CacheRow[];
  const row = rows[0];
  if (!row) return null;

  return {
    payload: row.payload,
    fresh: new Date(row.expires_at).getTime() > Date.now(),
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

export async function writeSportsCache(
  key: string,
  payload: unknown,
  ttlSeconds: number,
) {
  if (!configured()) return false;

  const now = new Date();
  const expires = new Date(now.getTime() + ttlSeconds * 1000);

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sports_cache?on_conflict=cache_key`,
    {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        cache_key: key,
        payload,
        expires_at: expires.toISOString(),
        updated_at: now.toISOString(),
      }),
      cache: "no-store",
    },
  );

  return response.ok;
}

export async function deleteExpiredSportsCache() {
  if (!configured()) return false;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sports_cache?expires_at=lt.${encodeURIComponent(
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    )}`,
    {
      method: "DELETE",
      headers: headers(),
      cache: "no-store",
    },
  );

  return response.ok;
}

export function sportsDbConfigured() {
  return configured();
}
