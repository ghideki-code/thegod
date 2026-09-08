import type { Candle } from '../../src/types.js';
import {
  fetchCandlesWithFallback,
  type ExchangeId,
  type RawCandle,
} from './exchangeClient.js';

export type MarketTimeframe = '15m' | '1h' | '4h' | '1d';

const INTERVAL_MAP: Record<MarketTimeframe, string> = {
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

function toCandle(raw: RawCandle): Candle {
  return {
    timestamp: raw.timestamp,
    timeStr: new Date(raw.timestamp).toISOString(),
    open: raw.open,
    high: raw.high,
    low: raw.low,
    close: raw.close,
    volume: raw.volume,
  };
}

function validateCandle(candle: Candle): boolean {
  return Number.isFinite(candle.timestamp)
    && Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close)
    && Number.isFinite(candle.volume)
    && candle.high >= Math.max(candle.open, candle.close, candle.low)
    && candle.low <= Math.min(candle.open, candle.close, candle.high)
    && candle.volume >= 0;
}

export async function fetchRealCandles(
  symbol: string,
  timeframe: MarketTimeframe,
  limit = 500,
  preferredExchange: ExchangeId = 'binance',
): Promise<{ exchange: ExchangeId; candles: Candle[] }> {
  const result = await fetchCandlesWithFallback({
    symbol,
    interval: INTERVAL_MAP[timeframe],
    limit,
  }, preferredExchange);

  const candles = result.candles
    .map(toCandle)
    .filter(validateCandle)
    .sort((a, b) => a.timestamp - b.timestamp);

  const deduplicated = candles.filter((candle, index) => (
    index === 0 || candle.timestamp !== candles[index - 1].timestamp
  ));

  return { exchange: result.exchange, candles: deduplicated };
}

export async function fetchMultiTimeframeCandles(
  symbol: string,
  limits: Partial<Record<MarketTimeframe, number>> = {},
): Promise<Record<MarketTimeframe, { exchange: ExchangeId; candles: Candle[] }>> {
  const timeframes: MarketTimeframe[] = ['15m', '1h', '4h', '1d'];
  const results = await Promise.all(
    timeframes.map(async (timeframe) => [
      timeframe,
      await fetchRealCandles(symbol, timeframe, limits[timeframe] ?? 500),
    ] as const),
  );

  return Object.fromEntries(results) as Record<MarketTimeframe, { exchange: ExchangeId; candles: Candle[] }>;
}
