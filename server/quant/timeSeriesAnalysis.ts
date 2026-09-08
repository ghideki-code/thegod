import type { HistoricalBacktestTrade } from '../backtest/historicalBacktest.js';

export interface TimeBucket {
  period: string;
  trades: number;
  netR: number;
  expectancyR: number;
  winRatePercent: number;
  profitFactor: number;
}

export interface TimeSeriesAnalysisResult {
  periods: TimeBucket[];
  positivePeriods: number;
  negativePeriods: number;
  consistencyPercent: number;
  bestPeriod: string | null;
  worstPeriod: string | null;
  warnings: string[];
}

const round = (v: number, d = 4) => Number((Number.isFinite(v) ? v : 0).toFixed(d));

function periodKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function analyzeTimeSeries(trades: HistoricalBacktestTrade[]): TimeSeriesAnalysisResult {
  const groups = new Map<string, HistoricalBacktestTrade[]>();
  for (const trade of trades) {
    const key = periodKey(trade.timestamp);
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  const periods = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, items]) => {
    const values = items.map(t => t.pnlR).filter(Number.isFinite);
    const wins = values.filter(v => v > 0).reduce((a, b) => a + b, 0);
    const losses = Math.abs(values.filter(v => v < 0).reduce((a, b) => a + b, 0));
    return {
      period,
      trades: values.length,
      netR: round(values.reduce((a, b) => a + b, 0)),
      expectancyR: round(values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0),
      winRatePercent: round(values.length ? values.filter(v => v > 0).length / values.length * 100 : 0, 2),
      profitFactor: round(losses > 0 ? wins / losses : wins > 0 ? Infinity : 0),
    };
  });
  const active = periods.filter(p => p.trades > 0);
  const positive = active.filter(p => p.netR > 0).length;
  const negative = active.filter(p => p.netR < 0).length;
  const warnings: string[] = [];
  if (active.length < 3) warnings.push('Menos de três períodos disponíveis para avaliar estabilidade temporal.');
  for (const period of active) if (period.trades < 10) warnings.push(`${period.period}: amostra pequena (${period.trades} trades).`);
  if (active.length && positive / active.length < 0.5) warnings.push('Menos da metade dos períodos apresentou resultado líquido positivo.');
  return {
    periods,
    positivePeriods: positive,
    negativePeriods: negative,
    consistencyPercent: round(active.length ? positive / active.length * 100 : 0, 2),
    bestPeriod: active.length ? [...active].sort((a, b) => b.expectancyR - a.expectancyR)[0].period : null,
    worstPeriod: active.length ? [...active].sort((a, b) => a.expectancyR - b.expectancyR)[0].period : null,
    warnings,
  };
}
