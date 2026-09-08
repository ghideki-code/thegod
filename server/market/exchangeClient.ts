export type ExchangeId = 'binance' | 'okx';

export interface RawCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FetchCandlesOptions {
  symbol: string;
  interval: string;
  limit?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function withTimeout(signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): AbortSignal {
  if (signal) return signal;
  return AbortSignal.timeout(timeoutMs);
}

function normalizeBinanceSymbol(symbol: string): string {
  return symbol.replace('/', '').toUpperCase();
}

function normalizeOkxInstrument(symbol: string): string {
  return symbol.replace('/', '-').toUpperCase();
}

function normalizeOkxBar(interval: string): string {
  const bars: Record<string, string> = {
    '15m': '15m',
    '1h': '1H',
    '4h': '4H',
    '1d': '1D',
  };
  return bars[interval] ?? interval;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    throw new Error(`Exchange HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchBinanceCandles(options: FetchCandlesOptions): Promise<RawCandle[]> {
  const symbol = normalizeBinanceSymbol(options.symbol);
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  const url = new URL('https://api.binance.com/api/v3/klines');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', options.interval);
  url.searchParams.set('limit', String(limit));

  const data = await fetchJson(url.toString(), options.signal);
  if (!Array.isArray(data)) throw new Error('Binance returned an invalid kline payload');

  return data.map((row: unknown[]) => ({
    timestamp: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

export async function fetchOkxCandles(options: FetchCandlesOptions): Promise<RawCandle[]> {
  const instId = normalizeOkxInstrument(options.symbol);
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  const url = new URL('https://www.okx.com/api/v5/market/candles');
  url.searchParams.set('instId', instId);
  url.searchParams.set('bar', normalizeOkxBar(options.interval));
  url.searchParams.set('limit', String(limit));

  const payload = await fetchJson(url.toString(), options.signal) as { code?: string; data?: string[][]; msg?: string };
  if (payload.code !== '0' || !Array.isArray(payload.data)) {
    throw new Error(`OKX returned an invalid candle payload for ${instId}: ${payload.msg ?? 'unknown error'}`);
  }

  return payload.data
    .map((row) => ({
      timestamp: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchCandlesWithFallback(
  options: FetchCandlesOptions,
  preferred: ExchangeId = 'binance',
): Promise<{ exchange: ExchangeId; candles: RawCandle[] }> {
  const order: ExchangeId[] = preferred === 'binance' ? ['binance', 'okx'] : ['okx', 'binance'];
  const errors: string[] = [];

  for (const exchange of order) {
    try {
      const candles = exchange === 'binance'
        ? await fetchBinanceCandles(options)
        : await fetchOkxCandles(options);
      if (candles.length === 0) throw new Error(`${exchange} returned no candles`);
      return { exchange, candles };
    } catch (error) {
      errors.push(`${exchange}: ${String(error)}`);
    }
  }

  throw new Error(`All candle providers failed. ${errors.join(' | ')}`);
}
