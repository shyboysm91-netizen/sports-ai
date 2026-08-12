export function dataCacheUrl(path: string, ttlSeconds: number) {
  return `/api/data-cache?cacheVersion=20260812-season-only&path=${encodeURIComponent(path)}&ttl=${ttlSeconds}`;
}
