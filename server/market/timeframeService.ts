import type { Candle } from '../../src/types.js';
import { fetchMultiTimeframeCandles, type MarketTimeframe } from './candleService.js';
import type { ExchangeId } from './exchangeClient.js';

export interface TimeframeSeries {
  timeframe: MarketTimeframe;
  exchange: ExchangeId;
  candles: Candle[];
  latestTimestamp: number;
}

export interface MultiTimeframeSnapshot {
  symbol: string;
  fetchedAt: number;
  series: Record<MarketTimeframe, TimeframeSeries>;
}

export async function loadMarketSnapshot(
  symbol: string,
  limits: Partial<Record<MarketTimeframe, number>> = {},
): Promise<MultiTimeframeSnapshot> {
  const raw = await fetchMultiTimeframeCandles(symbol, limits);
  const series = {} as Record<MarketTimeframe, TimeframeSeries>;

  for (const timeframe of ['15m', '1h', '4h', '1d'] as MarketTimeframe[]) {
    const candles = raw[timeframe].candles;
    series[timeframe] = {
      timeframe,
      exchange: raw[timeframe].exchange,
      candles,
      latestTimestamp: candles.at(-1)?.timestamp ?? 0,
    };
  }

  return {
    symbol,
    fetchedAt: Date.now(),
    series,
  };
}
