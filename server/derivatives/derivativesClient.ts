export interface DerivativesSnapshot {
  exchange: 'binance-futures' | 'okx-swap';
  symbol: string;
  timestamp: number;
  fundingRate: number | null;
  fundingTime: number | null;
  openInterest: number | null;
  openInterestValue: number | null;
  longShortRatio: number | null;
  longAccountRatio: number | null;
  shortAccountRatio: number | null;
}

const TIMEOUT_MS = 10_000;

function normalizeSymbol(symbol: string): string {
  return symbol.replace('/', '').toUpperCase();
}

function normalizeOkxSwapInstrument(symbol: string): string {
  const normalized = symbol.replace('/', '-').toUpperCase();
  return normalized.endsWith('-SWAP') ? normalized : `${normalized}-SWAP`;
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

async function fetchBinanceDerivativesSnapshot(symbol: string): Promise<DerivativesSnapshot> {
  const normalized = normalizeSymbol(symbol);
  const base = 'https://fapi.binance.com';
  const [funding, oi, ratio] = await Promise.all([
    getJson(`${base}/fapi/v1/premiumIndex?symbol=${normalized}`),
    getJson(`${base}/fapi/v1/openInterest?symbol=${normalized}`),
    getJson(`${base}/futures/data/globalLongShortAccountRatio?symbol=${normalized}&period=5m&limit=1`),
  ]);

  const ratioRow = Array.isArray(ratio) ? ratio[0] : null;
  const longShortRatio = ratioRow && Number.isFinite(Number(ratioRow.longShortRatio)) ? Number(ratioRow.longShortRatio) : null;
  const longAccountRatio = ratioRow && Number.isFinite(Number(ratioRow.longAccount)) ? Number(ratioRow.longAccount) : null;
  const shortAccountRatio = ratioRow && Number.isFinite(Number(ratioRow.shortAccount)) ? Number(ratioRow.shortAccount) : null;
  const fundingRate = Number.isFinite(Number(funding?.lastFundingRate)) ? Number(funding.lastFundingRate) : null;
  const openInterest = Number.isFinite(Number(oi?.openInterest)) ? Number(oi.openInterest) : null;
  const markPrice = Number.isFinite(Number(funding?.markPrice)) ? Number(funding.markPrice) : null;

  return {
    exchange: 'binance-futures',
    symbol: normalized,
    timestamp: Date.now(),
    fundingRate,
    fundingTime: Number.isFinite(Number(funding?.nextFundingTime)) ? Number(funding.nextFundingTime) : null,
    openInterest,
    openInterestValue: openInterest !== null && markPrice !== null ? openInterest * markPrice : null,
    longShortRatio,
    longAccountRatio,
    shortAccountRatio,
  };
}

async function fetchOkxDerivativesSnapshot(symbol: string): Promise<DerivativesSnapshot> {
  const instId = normalizeOkxSwapInstrument(symbol);
  const base = 'https://www.okx.com';
  const [funding, openInterestResponse] = await Promise.all([
    getJson(`${base}/api/v5/public/funding-rate?instId=${encodeURIComponent(instId)}`),
    getJson(`${base}/api/v5/public/open-interest?instType=SWAP&instId=${encodeURIComponent(instId)}`),
  ]);

  if (funding?.code !== '0' || !Array.isArray(funding?.data) || !funding.data[0]) {
    throw new Error(`OKX funding-rate returned an invalid payload for ${instId}`);
  }
  if (openInterestResponse?.code !== '0' || !Array.isArray(openInterestResponse?.data) || !openInterestResponse.data[0]) {
    throw new Error(`OKX open-interest returned an invalid payload for ${instId}`);
  }

  const fundingRow = funding.data[0];
  const oiRow = openInterestResponse.data[0];
  const fundingRate = Number.isFinite(Number(fundingRow.fundingRate)) ? Number(fundingRow.fundingRate) : null;
  const openInterest = Number.isFinite(Number(oiRow.oi)) ? Number(oiRow.oi) : null;
  const openInterestValue = Number.isFinite(Number(oiRow.oiUsd)) ? Number(oiRow.oiUsd) : null;

  return {
    exchange: 'okx-swap',
    symbol: normalizeSymbol(symbol),
    timestamp: Date.now(),
    fundingRate,
    fundingTime: Number.isFinite(Number(fundingRow.fundingTime)) ? Number(fundingRow.fundingTime) : null,
    openInterest,
    openInterestValue,
    longShortRatio: null,
    longAccountRatio: null,
    shortAccountRatio: null,
  };
}

export async function fetchDerivativesSnapshot(symbol: string): Promise<DerivativesSnapshot> {
  const errors: string[] = [];

  try {
    return await fetchBinanceDerivativesSnapshot(symbol);
  } catch (error) {
    errors.push(`Binance Futures: ${String(error)}`);
  }

  try {
    return await fetchOkxDerivativesSnapshot(symbol);
  } catch (error) {
    errors.push(`OKX SWAP: ${String(error)}`);
  }

  throw new Error(`All derivatives providers failed. ${errors.join(' | ')}`);
}
