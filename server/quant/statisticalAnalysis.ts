import type { HistoricalBacktestTrade } from '../backtest/historicalBacktest.js';

export interface DirectionBucket {
  direction: 'LONG' | 'SHORT' | 'UNKNOWN';
  trades: number;
  wins: number;
  losses: number;
  winRatePercent: number;
  netR: number;
  expectancyR: number;
  medianR: number;
  stdDevR: number;
  profitFactor: number;
  payoffRatio: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
}

export interface StatisticalAnalysisResult {
  sampleSize: number;
  meanR: number;
  medianR: number;
  stdDevR: number;
  standardErrorR: number;
  expectancyCi95R: { low: number; high: number } | null;
  positiveTradeRatePercent: number;
  payoffRatio: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  directions: DirectionBucket[];
  warnings: string[];
}

const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stats(values: number[]) {
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
    : 0;
  const wins = values.filter(v => v > 0);
  const losses = values.filter(v => v < 0);
  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  return {
    mean,
    median: median(values),
    stdDev: Math.sqrt(variance),
    wins: wins.length,
    losses: losses.length,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    payoffRatio: wins.length && losses.length ? (grossWin / wins.length) / (grossLoss / losses.length) : 0,
  };
}

function streak(values: number[]) {
  let wins = 0, losses = 0, maxWins = 0, maxLosses = 0;
  for (const value of values) {
    if (value > 0) { wins++; losses = 0; maxWins = Math.max(maxWins, wins); }
    else if (value < 0) { losses++; wins = 0; maxLosses = Math.max(maxLosses, losses); }
    else { wins = 0; losses = 0; }
  }
  return { maxWins, maxLosses };
}

function directionOf(trade: HistoricalBacktestTrade): DirectionBucket['direction'] {
  const candidate = trade as HistoricalBacktestTrade & { direction?: string; side?: string; signal?: { direction?: string } };
  const value = String(candidate.direction ?? candidate.side ?? candidate.signal?.direction ?? '').toUpperCase();
  if (value.includes('LONG') || value === 'BUY') return 'LONG';
  if (value.includes('SHORT') || value === 'SELL') return 'SHORT';
  return 'UNKNOWN';
}

function directionBucket(direction: DirectionBucket['direction'], trades: HistoricalBacktestTrade[]): DirectionBucket {
  const values = trades.map(t => t.pnlR);
  const s = stats(values);
  const streaks = streak(values);
  return {
    direction,
    trades: values.length,
    wins: s.wins,
    losses: s.losses,
    winRatePercent: round(values.length ? s.wins / values.length * 100 : 0, 2),
    netR: round(values.reduce((a, b) => a + b, 0)),
    expectancyR: round(s.mean),
    medianR: round(s.median),
    stdDevR: round(s.stdDev),
    profitFactor: round(s.profitFactor),
    payoffRatio: round(s.payoffRatio),
    maxConsecutiveLosses: streaks.maxLosses,
    maxConsecutiveWins: streaks.maxWins,
  };
}

export function analyzeStatistics(trades: HistoricalBacktestTrade[]): StatisticalAnalysisResult {
  const values = trades.map(t => t.pnlR).filter(Number.isFinite);
  const s = stats(values);
  const streaks = streak(values);
  const standardError = values.length > 1 ? s.stdDev / Math.sqrt(values.length) : 0;
  const ci = values.length >= 30 ? { low: s.mean - 1.96 * standardError, high: s.mean + 1.96 * standardError } : null;
  const groups = new Map<DirectionBucket['direction'], HistoricalBacktestTrade[]>();
  for (const trade of trades) {
    const direction = directionOf(trade);
    groups.set(direction, [...(groups.get(direction) ?? []), trade]);
  }
  const directions = (['LONG', 'SHORT', 'UNKNOWN'] as const).map(direction => directionBucket(direction, groups.get(direction) ?? []));
  const warnings: string[] = [];
  if (values.length < 30) warnings.push(`Amostra estatística pequena: ${values.length} trades.`);
  if (values.length >= 30 && s.mean <= 0) warnings.push('Intervalo de confiança da expectancy não parte de uma média positiva.');
  if (s.stdDev > Math.abs(s.mean) * 3 && values.length >= 30) warnings.push('Alta dispersão dos resultados em relação à expectancy.');
  if (streaks.maxLosses >= 6) warnings.push(`Sequência máxima de ${streaks.maxLosses} perdas consecutivas.`);
  for (const bucket of directions.filter(d => d.trades > 0)) {
    if (bucket.trades < 20) warnings.push(`${bucket.direction}: amostra abaixo de 20 trades.`);
    if (bucket.expectancyR < 0) warnings.push(`${bucket.direction}: expectancy negativa.`);
  }
  return {
    sampleSize: values.length,
    meanR: round(s.mean),
    medianR: round(s.median),
    stdDevR: round(s.stdDev),
    standardErrorR: round(standardError),
    expectancyCi95R: ci ? { low: round(ci.low), high: round(ci.high) } : null,
    positiveTradeRatePercent: round(values.length ? s.wins / values.length * 100 : 0, 2),
    payoffRatio: round(s.payoffRatio),
    maxConsecutiveLosses: streaks.maxLosses,
    maxConsecutiveWins: streaks.maxWins,
    directions,
    warnings,
  };
}
