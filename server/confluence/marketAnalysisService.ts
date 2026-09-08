import { calculateIndicators } from '../indicators/technicalIndicators.js';
import { getMarketSnapshot } from '../market/marketSnapshotService.js';
import { analyzeMarketStructure } from '../structure/marketStructure.js';
import { analyzeSMC } from '../structure/smc.js';
import { fetchDerivativesSnapshot } from '../derivatives/derivativesClient.js';
import { analyzeDerivatives } from '../derivatives/derivativesAnalysis.js';
import { detectDivergences, type DivergenceAnalysis } from '../divergence/divergenceEngine.js';
import { analyzeGann, type GannAnalysis } from '../gann/gannEngine.js';
import { analyzeWyckoff, type WyckoffAnalysis } from '../wyckoff/wyckoffEngine.js';
import { calculateConfluence, type ConfluenceAnalysis } from './confluenceEngine.js';
import type { MarketTimeframe } from '../market/candleService.js';

export interface TimeframeMarketAnalysis {
  timeframe: MarketTimeframe;
  exchange: string;
  latestTimestamp: number;
  indicators: ReturnType<typeof calculateIndicators>;
  structure: ReturnType<typeof analyzeMarketStructure>;
  smc: ReturnType<typeof analyzeSMC>;
  divergences: DivergenceAnalysis;
  gann: GannAnalysis;
  wyckoff: WyckoffAnalysis;
}

export interface MarketAnalysis {
  symbol: string;
  fetchedAt: number;
  timeframes: TimeframeMarketAnalysis[];
  derivatives: ReturnType<typeof analyzeDerivatives> | null;
  confluence: ConfluenceAnalysis;
}

export async function analyzeMarket(symbol: string, forceRefresh = false): Promise<MarketAnalysis> {
  const snapshot = await getMarketSnapshot(symbol, { forceRefresh });
  const timeframes = (['15m', '1h', '4h', '1d'] as MarketTimeframe[]).map((timeframe) => {
    const series = snapshot.series[timeframe];
    const indicators = calculateIndicators(series.candles);
    const structure = analyzeMarketStructure(series.candles);
    const smc = analyzeSMC(series.candles, structure, indicators);
    const divergences = detectDivergences(series.candles, indicators);
    const gann = analyzeGann(series.candles, structure);
    const wyckoff = analyzeWyckoff(series.candles, structure, indicators);
    return { timeframe, exchange: series.exchange, latestTimestamp: series.latestTimestamp, indicators, structure, smc, divergences, gann, wyckoff };
  });

  let derivatives: ReturnType<typeof analyzeDerivatives> | null = null;
  try {
    derivatives = analyzeDerivatives(await fetchDerivativesSnapshot(symbol));
  } catch (error) {
    console.warn(`Derivatives unavailable for ${symbol}:`, error);
  }

  return {
    symbol: snapshot.symbol,
    fetchedAt: snapshot.fetchedAt,
    timeframes,
    derivatives,
    confluence: calculateConfluence(timeframes, derivatives),
  };
}
