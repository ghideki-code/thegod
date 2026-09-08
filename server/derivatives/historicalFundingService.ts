export interface HistoricalFundingRate {
  timestamp: number;
  fundingRate: number;
  symbol: string;
  source: 'binance-futures' | 'okx-swap';
}

const TIMEOUT_MS = 10_000;
const PAGE_LIMIT_BINANCE = 1000;
const PAGE_LIMIT_OKX = 400;
const OKX_MAX_HISTORY_MS = 90 * 86_400_000;
const MAX_RATE = 0.01;

function normalizeSymbol(symbol: string): string {
  return symbol.replace('/', '').toUpperCase();
}

function normalizeOkxSwap(symbol: string): string {
  const [base, quote] = symbol.toUpperCase().split('/');
  return `${base}-${quote}-SWAP`;
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

function uniqueSorted(rows: HistoricalFundingRate[]): HistoricalFundingRate[] {
  const unique = new Map<string, HistoricalFundingRate>();
  for (const row of rows) unique.set(`${row.source}:${row.timestamp}`, row);
  return [...unique.values()].sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchBinanceHistoricalFunding(
  symbol: string,
  startTime: number,
  endTime: number,
): Promise<HistoricalFundingRate[]> {
  const normalized = normalizeSymbol(symbol);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return [];

  const result: HistoricalFundingRate[] = [];
  let cursor = Math.max(0, Math.floor(startTime));
  const finalTime = Math.floor(endTime);

  while (cursor <= finalTime) {
    const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${normalized}&startTime=${cursor}&endTime=${finalTime}&limit=${PAGE_LIMIT_BINANCE}`;
    const rows = await getJson(url);
    if (!Array.isArray(rows) || rows.length === 0) break;

    let newest = cursor;
    for (const row of rows) {
      const timestamp = Number(row?.fundingTime);
      const fundingRate = Number(row?.fundingRate);
      if (!Number.isFinite(timestamp) || !Number.isFinite(fundingRate)) continue;
      if (timestamp < startTime || timestamp > finalTime) continue;
      result.push({
        timestamp,
        fundingRate: Math.max(-MAX_RATE, Math.min(MAX_RATE, fundingRate)),
        symbol: normalized,
        source: 'binance-futures',
      });
      newest = Math.max(newest, timestamp);
    }

    if (rows.length < PAGE_LIMIT_BINANCE || newest <= cursor) break;
    cursor = newest + 1;
  }

  return uniqueSorted(result);
}

/**
 * OKX fallback for environments where Binance historical endpoints are geo-blocked.
 * The public OKX API currently exposes roughly three months through this endpoint.
 */
export async function fetchHistoricalOkxFunding(
  symbol: string,
  startTime: number,
  endTime: number,
): Promise<HistoricalFundingRate[]> {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return [];

  const instId = normalizeOkxSwap(symbol);
  const effectiveStart = Math.max(Math.floor(startTime), Math.floor(endTime) - OKX_MAX_HISTORY_MS);
  const finalTime = Math.floor(endTime);
  const result: HistoricalFundingRate[] = [];
  let after: number | null = null;

  for (let page = 0; page < 100; page += 1) {
    const params = new URLSearchParams({ instId, limit: String(PAGE_LIMIT_OKX) });
    if (after !== null) params.set('after', String(after));
    const payload = await getJson(`https://www.okx.com/api/v5/public/funding-rate-history?${params.toString()}`);
    if (String(payload?.code ?? '0') !== '0') throw new Error(`OKX funding history error: ${payload?.msg || payload?.code || 'unknown error'}`);
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    if (!rows.length) break;

    let oldest = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const timestamp = Number(row?.fundingTime);
      const fundingRate = Number(row?.realizedRate ?? row?.fundingRate);
      if (!Number.isFinite(timestamp) || !Number.isFinite(fundingRate)) continue;
      oldest = Math.min(oldest, timestamp);
      if (timestamp < effectiveStart || timestamp > finalTime) continue;
      result.push({
        timestamp,
        fundingRate: Math.max(-MAX_RATE, Math.min(MAX_RATE, fundingRate)),
        symbol: instId,
        source: 'okx-swap',
      });
    }

    if (oldest === Number.POSITIVE_INFINITY || oldest <= effectiveStart || rows.length < PAGE_LIMIT_OKX) break;
    after = oldest;
  }

  return uniqueSorted(result);
}

/**
 * Backward-compatible entry point used by the server routes.
 * Binance remains canonical. If Binance returns an access error or no data,
 * use real OKX historical funding rather than failing the whole backtest.
 */
export async function fetchHistoricalBinanceFunding(
  symbol: string,
  startTime: number,
  endTime: number,
): Promise<HistoricalFundingRate[]> {
  try {
    const binance = await fetchBinanceHistoricalFunding(symbol, startTime, endTime);
    if (binance.length) return binance;
  } catch (error) {
    console.warn(`Binance historical funding unavailable for ${symbol}:`, error);
  }

  try {
    const okx = await fetchHistoricalOkxFunding(symbol, startTime, endTime);
    if (okx.length) return okx;
  } catch (error) {
    console.warn(`OKX historical funding unavailable for ${symbol}:`, error);
  }

  return [];
}

export const fetchHistoricalFunding = fetchHistoricalBinanceFunding;
