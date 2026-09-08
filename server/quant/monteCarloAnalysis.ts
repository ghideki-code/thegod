import type { HistoricalBacktestTrade } from '../backtest/historicalBacktest.js';

export interface MonteCarloAnalysisResult {
  simulations: number;
  sampleSize: number;
  expectancyR: number;
  medianFinalR: number;
  p05FinalR: number;
  p95FinalR: number;
  medianMaxDrawdownR: number;
  p95MaxDrawdownR: number;
  probabilityOfLossPercent: number;
  probabilityOfDrawdownOver10RPercent: number;
  grade: 'ROBUST' | 'MODERATE' | 'FRAGILE' | 'INSUFFICIENT_DATA';
  warnings: string[];
}

const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const index = (values.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}

/**
 * Bootstrap Monte Carlo using account-equity compounding.
 * pnlR remains the trade result in units of risk, while the simulated
 * account applies the configured risk percentage to each trade.
 */
export function analyzeMonteCarlo(
  trades: HistoricalBacktestTrade[],
  simulations = 3000,
  riskPerTradePercent = 1,
): MonteCarloAnalysisResult {
  const values = trades.map(t => t.pnlR).filter(Number.isFinite);
  const safeRiskPercent = Number.isFinite(riskPerTradePercent) && riskPerTradePercent > 0 ? riskPerTradePercent : 1;
  const riskFraction = safeRiskPercent / 100;

  if (values.length < 30) return {
    simulations,
    sampleSize: values.length,
    expectancyR: round(values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0),
    medianFinalR: 0,
    p05FinalR: 0,
    p95FinalR: 0,
    medianMaxDrawdownR: 0,
    p95MaxDrawdownR: 0,
    probabilityOfLossPercent: 0,
    probabilityOfDrawdownOver10RPercent: 0,
    grade: 'INSUFFICIENT_DATA',
    warnings: ['São necessários pelo menos 30 trades para Monte Carlo.'],
  };

  const random = rng(20260908 + values.length + Math.round(safeRiskPercent * 100));
  const finals: number[] = [];
  const drawdowns: number[] = [];
  let losses = 0;
  let largeDrawdowns = 0;

  for (let i = 0; i < simulations; i++) {
    let equity = 1;
    let peak = 1;
    let maxDdFraction = 0;

    for (let j = 0; j < values.length; j++) {
      const tradeR = values[Math.floor(random() * values.length)];
      equity *= Math.max(0, 1 + tradeR * riskFraction);
      peak = Math.max(peak, equity);
      maxDdFraction = Math.max(maxDdFraction, peak > 0 ? (peak - equity) / peak : 0);
    }

    finals.push((equity - 1) / riskFraction);
    drawdowns.push(maxDdFraction / riskFraction);
    if (equity < 1) losses++;
    if (maxDdFraction / riskFraction > 10) largeDrawdowns++;
  }

  finals.sort((a, b) => a - b);
  drawdowns.sort((a, b) => a - b);
  const probabilityLoss = losses / simulations * 100;
  const probabilityLargeDd = largeDrawdowns / simulations * 100;
  const warnings: string[] = [];

  if (probabilityLoss > 25) warnings.push(`Monte Carlo: ${round(probabilityLoss, 2)}% das simulações terminaram abaixo do capital inicial.`);
  if (probabilityLargeDd > 25) warnings.push(`Monte Carlo: ${round(probabilityLargeDd, 2)}% das simulações excederam 10R de drawdown.`);

  const grade = probabilityLoss < 5 && probabilityLargeDd < 10
    ? 'ROBUST'
    : probabilityLoss < 15 && probabilityLargeDd < 25
      ? 'MODERATE'
      : 'FRAGILE';

  return {
    simulations,
    sampleSize: values.length,
    expectancyR: round(values.reduce((a, b) => a + b, 0) / values.length),
    medianFinalR: round(percentile(finals, 0.5)),
    p05FinalR: round(percentile(finals, 0.05)),
    p95FinalR: round(percentile(finals, 0.95)),
    medianMaxDrawdownR: round(percentile(drawdowns, 0.5)),
    p95MaxDrawdownR: round(percentile(drawdowns, 0.95)),
    probabilityOfLossPercent: round(probabilityLoss, 2),
    probabilityOfDrawdownOver10RPercent: round(probabilityLargeDd, 2),
    grade,
    warnings,
  };
}
