import type { Candle } from '../../src/types.js';
import type { HistoricalBacktestTrade } from '../backtest/historicalBacktest.js';
import type { HistoricalFundingRate } from '../derivatives/historicalFundingService.js';

export type TrendRegime = 'BULL' | 'BEAR' | 'RANGE';
export type VolatilityRegime = 'LOW' | 'NORMAL' | 'HIGH';
export type FundingRegime = 'FAVORABLE' | 'NEUTRAL' | 'ADVERSE' | 'UNAVAILABLE';

export interface MultiRegimeCell {
  key: string;
  trend: TrendRegime;
  volatility: VolatilityRegime;
  funding: FundingRegime;
  trades: number;
  wins: number;
  winRatePercent: number;
  netR: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownR: number;
}

export interface MultiRegimeValidationResult {
  totalCells: number;
  coveredCells: number;
  evaluatedCells: number;
  positiveCells: number;
  coveragePercent: number;
  consistencyPercent: number;
  worstExpectancyR: number;
  status: 'ROBUST' | 'MIXED' | 'FRAGILE' | 'INSUFFICIENT_DATA';
  minimumTradesPerCell: number;
  fundingEvents: number;
  fundingCoveragePercent: number;
  fundingSources: { binance: number; okx: number };
  firstFundingTimestamp: number | null;
  lastFundingTimestamp: number | null;
  warnings: string[];
  cells: MultiRegimeCell[];
}

const round = (value: number, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function profitFactor(values: number[]): number {
  const wins = values.filter(v => v > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(values.filter(v => v < 0).reduce((a, b) => a + b, 0));
  return losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;
}

function drawdownR(values: number[]): number {
  let equity = 0;
  let peak = 0;
  let max = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    max = Math.max(max, peak - equity);
  }
  return max;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))];
}

function latestFundingAtOrBefore(funding: HistoricalFundingRate[], timestamp: number): HistoricalFundingRate | null {
  let latest: HistoricalFundingRate | null = null;
  for (const row of funding) {
    if (row.timestamp > timestamp) break;
    latest = row;
  }
  return latest;
}

function classifyTrend(candles: Candle[], index: number): TrendRegime {
  const start = Math.max(0, index - 63);
  const window = candles.slice(start, index + 1);
  if (window.length < 32) return 'RANGE';
  const closes = window.map(c => c.close);
  const move = closes.at(-1)! / closes[0] - 1;
  const volatility = Math.sqrt(mean(closes.slice(1).map((v, i) => {
    const r = v / closes[i] - 1;
    return r * r;
  })));
  const threshold = Math.max(volatility * 2.5, 0.003);
  if (move >= threshold) return 'BULL';
  if (move <= -threshold) return 'BEAR';
  return 'RANGE';
}

function classifyVolatility(candles: Candle[], index: number): VolatilityRegime {
  const start = Math.max(0, index - 95);
  const window = candles.slice(start, index + 1);
  if (window.length < 32) return 'NORMAL';
  const returns = window.slice(1).map((c, i) => c.close / window[i].close - 1);
  const currentWindow = returns.slice(-31);
  const current = Math.sqrt(mean(currentWindow.map(r => r * r)));
  const history: number[] = [];
  for (let i = 31; i < returns.length; i += 1) {
    const sample = returns.slice(i - 31, i + 1);
    history.push(Math.sqrt(mean(sample.map(r => r * r))));
  }
  const low = percentile(history, 0.33);
  const high = percentile(history, 0.67);
  if (current <= low) return 'LOW';
  if (current >= high) return 'HIGH';
  return 'NORMAL';
}

function classifyFunding(
  funding: HistoricalFundingRate[],
  timestamp: number,
  direction: HistoricalBacktestTrade['direction'],
): FundingRegime {
  const latest = latestFundingAtOrBefore(funding, timestamp);
  if (!latest) return 'UNAVAILABLE';
  const abs = Math.abs(latest.fundingRate);
  const neutralThreshold = 0.00005;
  if (abs <= neutralThreshold) return 'NEUTRAL';
  const favorable = direction === 'LONG' ? latest.fundingRate < 0 : latest.fundingRate > 0;
  return favorable ? 'FAVORABLE' : 'ADVERSE';
}

export function validateMultiRegime(
  candles: Candle[],
  trades: HistoricalBacktestTrade[],
  historicalFunding: HistoricalFundingRate[] = [],
  minimumTradesPerCell = 10,
): MultiRegimeValidationResult {
  const safeCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const safeFunding = [...historicalFunding].filter(x => Number.isFinite(x.timestamp) && Number.isFinite(x.fundingRate)).sort((a, b) => a.timestamp - b.timestamp);
  const trendValues: TrendRegime[] = ['BULL', 'BEAR', 'RANGE'];
  const volatilityValues: VolatilityRegime[] = ['LOW', 'NORMAL', 'HIGH'];
  const fundingValues: FundingRegime[] = safeFunding.length ? ['FAVORABLE', 'NEUTRAL', 'ADVERSE'] : ['FAVORABLE', 'NEUTRAL', 'ADVERSE', 'UNAVAILABLE'];
  const buckets = new Map<string, number[]>();

  for (const trade of trades) {
    let entryIndex = safeCandles.findIndex(c => c.timestamp === trade.timestamp);
    if (entryIndex < 0) entryIndex = safeCandles.findIndex(c => c.timestamp >= trade.timestamp);
    if (entryIndex <= 0) continue;
    const signalIndex = entryIndex - 1;
    const trend = classifyTrend(safeCandles, signalIndex);
    const volatility = classifyVolatility(safeCandles, signalIndex);
    const funding = classifyFunding(safeFunding, safeCandles[signalIndex].timestamp, trade.direction);
    const key = `${trend}|${volatility}|${funding}`;
    buckets.set(key, [...(buckets.get(key) ?? []), trade.pnlR]);
  }

  const cells: MultiRegimeCell[] = [];
  for (const trend of trendValues) {
    for (const volatility of volatilityValues) {
      for (const funding of fundingValues) {
        const key = `${trend}|${volatility}|${funding}`;
        const values = buckets.get(key) ?? [];
        const wins = values.filter(v => v > 0).length;
        cells.push({
          key,
          trend,
          volatility,
          funding,
          trades: values.length,
          wins,
          winRatePercent: round(values.length ? wins / values.length * 100 : 0, 2),
          netR: round(values.reduce((a, b) => a + b, 0)),
          expectancyR: round(mean(values)),
          profitFactor: round(profitFactor(values)),
          maxDrawdownR: round(drawdownR(values)),
        });
      }
    }
  }

  const covered = cells.filter(c => c.trades > 0);
  const evaluated = cells.filter(c => c.trades >= minimumTradesPerCell);
  const positive = evaluated.filter(c => c.expectancyR > 0);
  const coveragePercent = cells.length ? covered.length / cells.length * 100 : 0;
  const consistencyPercent = evaluated.length ? positive.length / evaluated.length * 100 : 0;
  const worstExpectancyR = evaluated.length ? Math.min(...evaluated.map(c => c.expectancyR)) : 0;
  const sourceCounts = {
    binance: safeFunding.filter(x => x.source === 'binance-futures').length,
    okx: safeFunding.filter(x => x.source === 'okx-swap').length,
  };
  const entryTimestamps = trades.map(t => t.timestamp).filter(Number.isFinite);
  const firstEntry = entryTimestamps.length ? Math.min(...entryTimestamps) : null;
  const lastEntry = entryTimestamps.length ? Math.max(...entryTimestamps) : null;
  const fundingAtEntries = trades.filter(t => latestFundingAtOrBefore(safeFunding, t.timestamp)).length;
  const fundingCoveragePercent = trades.length ? fundingAtEntries / trades.length * 100 : 0;
  const warnings: string[] = [];
  if (!safeFunding.length) warnings.push('Nenhum evento histórico de funding disponível para classificar o eixo de funding.');
  if (fundingCoveragePercent < 95 && trades.length) warnings.push(`Cobertura de funding na entrada em ${round(fundingCoveragePercent, 1)}% dos trades.`);
  if (covered.length < Math.min(9, cells.length)) warnings.push('A matriz cobre poucas combinações de regimes; aumentar a janela pode melhorar a representatividade.');
  if (evaluated.some(c => c.expectancyR <= 0)) warnings.push('Existe pelo menos uma combinação de regime relevante com expectancy não positiva.');
  if (evaluated.length < 5) warnings.push(`Menos de cinco células atingiram o mínimo de ${minimumTradesPerCell} trades.`);
  const status = evaluated.length < 5
    ? 'INSUFFICIENT_DATA'
    : consistencyPercent >= 75 && worstExpectancyR > 0
      ? 'ROBUST'
      : consistencyPercent >= 50
        ? 'MIXED'
        : 'FRAGILE';

  return {
    totalCells: cells.length,
    coveredCells: covered.length,
    evaluatedCells: evaluated.length,
    positiveCells: positive.length,
    coveragePercent: round(coveragePercent, 1),
    consistencyPercent: round(consistencyPercent, 1),
    worstExpectancyR: round(worstExpectancyR),
    status,
    minimumTradesPerCell,
    fundingEvents: safeFunding.length,
    fundingCoveragePercent: round(fundingCoveragePercent, 1),
    fundingSources: sourceCounts,
    firstFundingTimestamp: safeFunding[0]?.timestamp ?? null,
    lastFundingTimestamp: safeFunding.at(-1)?.timestamp ?? null,
    warnings,
    cells,
  };
}
