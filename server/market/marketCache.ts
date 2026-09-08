import type { MultiTimeframeSnapshot } from './timeframeService.js';

interface CacheEntry {
  snapshot: MultiTimeframeSnapshot;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 15_000;
const MAX_ENTRIES = 100;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function getCachedMarketSnapshot(symbol: string): MultiTimeframeSnapshot | null {
  const key = normalizeSymbol(symbol);
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.snapshot;
}

export function setCachedMarketSnapshot(
  symbol: string,
  snapshot: MultiTimeframeSnapshot,
  ttlMs = DEFAULT_TTL_MS,
): void {
  const key = normalizeSymbol(symbol);
  cache.delete(key);
  cache.set(key, {
    snapshot,
    expiresAt: Date.now() + Math.max(ttlMs, 1_000),
  });

  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export function invalidateMarketSnapshot(symbol?: string): void {
  if (symbol) {
    cache.delete(normalizeSymbol(symbol));
    return;
  }
  cache.clear();
}

export function getMarketCacheStats(): { entries: number; symbols: string[] } {
  return {
    entries: cache.size,
    symbols: [...cache.keys()],
  };
}
