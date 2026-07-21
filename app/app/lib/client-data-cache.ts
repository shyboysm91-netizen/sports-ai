export function dataCacheUrl(path: string, ttlSeconds: number) {
  return `/api/data-cache?path=${encodeURIComponent(path)}&ttl=${ttlSeconds}`;
}
