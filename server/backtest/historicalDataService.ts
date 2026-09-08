import type { Candle } from '../../src/types.js';

const INTERVAL_MS: Record<string, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

const OKX_BAR: Record<string, string> = {
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1Dutc',
};

const TIMEOUT_MS = 10_000;

function normalizeSymbol(symbol: string): string {
  return symbol.replace('/', '').toUpperCase();
}

function normalizeOkxSpotInstrument(symbol: string): string {
  return symbol.replace('/', '-').toUpperCase();
}

function parseCandle(row: unknown): Candle | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const timestamp = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  const volume = Number(row[5]);

  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(volume) ||
    high < Math.max(open, close, low) ||
    low > Math.min(open, close, high) ||
    volume < 0
  ) return null;

  return {
    timestamp,
    timeStr: new Date(timestamp).toISOString(),
    open,
    high,
    low,
    close,
    volume,
  };
}

async function fetchBinanceHistoricalCandles(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const step = INTERVAL_MS[interval];
  if (!step) throw new Error(`Unsupported historical interval: ${interval}`);

  const result: Candle[] = [];
  let cursor = startTime;
  const maxPages = Math.ceil((endTime - startTime) / step / 1000) + 2;

  for (let page = 0; page < maxPages && cursor < endTime; page += 1) {
    const url = new URL('https://api.binance.com/api/v3/klines');
    url.searchParams.set('symbol', normalizeSymbol(symbol));
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('startTime', String(cursor));
    url.searchParams.set('endTime', String(endTime));

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Binance historical HTTP ${response.status}`);
    const data = await response.json() as unknown;
    if (!Array.isArray(data)) throw new Error('Binance historical payload is invalid');
    if (data.length === 0) break;

    for (const row of data) {
      const candle = parseCandle(row);
      if (candle && candle.timestamp >= startTime && candle.timestamp < endTime) result.push(candle);
    }

    const lastTimestamp = Number((data[data.length - 1] as unknown[])[0]);
    if (!Number.isFinite(lastTimestamp) || lastTimestamp < cursor) break;
    cursor = lastTimestamp + step;
    if (data.length < 1000) break;
  }

  return result;
}

async function fetchOkxHistoricalCandles(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const step = INTERVAL_MS[interval];
  const bar = OKX_BAR[interval];
  if (!step || !bar) throw new Error(`Unsupported OKX historical interval: ${interval}`);

  const instId = normalizeOkxSpotInstrument(symbol);
  const result: Candle[] = [];
  let after: number | null = null;
  const maxPages = Math.ceil((endTime - startTime) / step / 300) + 4;

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL('https://www.okx.com/api/v5/market/history-candles');
    url.searchParams.set('instId', instId);
    url.searchParams.set('bar', bar);
    url.searchParams.set('limit', '300');
    if (after !== null) url.searchParams.set('after', String(after));

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`OKX historical HTTP ${response.status}`);

    const payload = await response.json() as unknown;
    if (!payload || typeof payload !== 'object') throw new Error('OKX historical payload is invalid');
    const body = payload as { code?: string; msg?: string; data?: unknown[] };
    if (body.code !== '0' || !Array.isArray(body.data)) {
      throw new Error(`OKX historical returned code ${body.code ?? 'unknown'}: ${body.msg ?? 'invalid payload'}`);
    }
    if (body.data.length === 0) break;

    let oldestTimestamp = Number.POSITIVE_INFINITY;
    let added = 0;

    for (const row of body.data) {
      const candle = parseCandle(row);
      if (!candle) continue;
      oldestTimestamp = Math.min(oldestTimestamp, candle.timestamp);
      if (candle.timestamp >= startTime && candle.timestamp < endTime) {
        result.push(candle);
        added += 1;
      }
    }

    if (!Number.isFinite(oldestTimestamp) || oldestTimestamp <= startTime) break;
    if (added === 0 && oldestTimestamp < startTime) break;

    const nextAfter = oldestTimestamp;
    if (after !== null && nextAfter >= after) break;
    after = nextAfter;
  }

  return result;
}

function dedupeAndSort(candles: Candle[]): Candle[] {
  const unique = new Map<number, Candle>();
  for (const candle of candles) unique.set(candle.timestamp, candle);
  return [...unique.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchHistoricalBinanceCandles(
  symbol: string,
  interval = '15m',
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const step = INTERVAL_MS[interval];
  if (!step) throw new Error(`Unsupported historical interval: ${interval}`);
  if (endTime <= startTime) throw new Error('Historical endTime must be greater than startTime');

  try {
    const binanceCandles = await fetchBinanceHistoricalCandles(symbol, interval, startTime, endTime);
    if (binanceCandles.length >= 300) return dedupeAndSort(binanceCandles);
  } catch (error) {
    console.warn(`Binance historical unavailable for ${symbol}:`, error);
  }

  const okxCandles = await fetchOkxHistoricalCandles(symbol, interval, startTime, endTime);
  const candles = dedupeAndSort(okxCandles);
  if (candles.length === 0) {
    throw new Error(`All historical providers failed for ${symbol}. Binance and OKX returned no usable candles.`);
  }
  return candles;
}
