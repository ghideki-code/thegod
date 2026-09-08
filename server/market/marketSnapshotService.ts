import { getCachedMarketSnapshot, setCachedMarketSnapshot } from './marketCache.js';
import { loadMarketSnapshot, type MultiTimeframeSnapshot } from './timeframeService.js';

export async function getMarketSnapshot(
  symbol: string,
  options: {
    forceRefresh?: boolean;
    limits?: Parameters<typeof loadMarketSnapshot>[1];
  } = {},
): Promise<MultiTimeframeSnapshot> {
  if (!options.forceRefresh) {
    const cached = getCachedMarketSnapshot(symbol);
    if (cached) return cached;
  }

  const snapshot = await loadMarketSnapshot(symbol, options.limits);
  setCachedMarketSnapshot(symbol, snapshot);
  return snapshot;
}
